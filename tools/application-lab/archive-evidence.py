#!/usr/bin/env python3
"""Archive selected evidence and its explicit hash bindings; standard library only.

create NEW_DIR --select FILE [--selection FILES.json] [--recover DIR_OR_FILE]
verify DIRECTORY_OR_TAR_GZ
pack VERIFIED_DIR NEW.tar.gz
extract VERIFIED_TAR_GZ NEW_DIR
self-test

Selection JSON: {"files": [{"path": "/absolute/file", "sha256": "optional",
                            "opaque": false}]}. Files, never implicit directory
trees, are selected. --opaque FILE preserves an intentionally unparsed raw log.
Recovery walks only opt-in roots and skips node_modules, .git and symlinks.
No source/dependency bytes are substituted unless their recorded hash matches.
The archive proves byte integrity, not authenticity, semantic correctness,
complete history, installed dependency closure or build reproducibility.
"""

import argparse
import base64
import hashlib
import io
import json
import os
import re
import shutil
import stat
import sys
import tarfile
import tempfile
from collections import deque
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath


FORMAT = "signaltree-study-evidence-v1"
HASH = re.compile(r"^[0-9a-f]{64}$")
SHA512 = re.compile(r"^[0-9a-f]{128}$")
VERIFIER = "archive-evidence.py"
FIXED = {"manifest.json", "manifest.sha256", VERIFIER}
HASH_MAP_NAMES = {"inputs", "bindings", "dependencies", "served", "receipts",
                  "packageHashes", "loadedModuleHashes", "hashes", "files"}
SKIP_RECOVERY = {"node_modules", ".git", ".nx", "__pycache__"}
JSON_DIGESTS = {"planSha256", "packetPlanSha256", "scheduleSha256", "buildSha256",
                "statsSha256", "summarySha256", "packageLockSha256", "lockSha256",
                "toolchainLockSha256"}


class ArchiveError(Exception):
    """A missing identity, invalid binding, unsafe path or altered payload."""


def require(condition, message):
    if not condition:
        raise ArchiveError(message)


def json_bytes(value):
    return (json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False) + "\n").encode()


def write_new(path, data):
    with Path(path).open("xb") as stream:
        stream.write(data)


def parse_json(data, label):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, f"Duplicate JSON key in {label}: {key}")
            result[key] = value
        return result
    try:
        return json.loads(data, object_pairs_hook=unique)
    except (ValueError, UnicodeError) as error:
        raise ArchiveError(f"Invalid JSON {label}: {error}") from error


def digests(stream, copy=None):
    sha256, sha512, size = hashlib.sha256(), hashlib.sha512(), 0
    while chunk := stream.read(1024 * 1024):
        sha256.update(chunk)
        sha512.update(chunk)
        size += len(chunk)
        if copy is not None:
            copy.write(chunk)
    return {"sha256": sha256.hexdigest(), "sha512": sha512.hexdigest(), "size": size}


def file_digests(path):
    require(Path(path).is_file(), f"Missing regular input file: {path}")
    with open(path, "rb") as stream:
        require(stat.S_ISREG(os.fstat(stream.fileno()).st_mode), f"Nonregular input: {path}")
        return digests(stream)


def pointer(parts):
    return "/" + "/".join(str(part).replace("~", "~0").replace("/", "~1") for part in parts)


def reference(original, algorithm, expected, where):
    require(algorithm in ("sha256", "sha512"), f"Unsupported hash algorithm: {algorithm}")
    require(isinstance(expected, str) and (HASH if algorithm == "sha256" else SHA512).fullmatch(expected),
            f"Malformed expected {algorithm} at {where}")
    if original is None:
        original = f"hash:{algorithm}:{expected}"
    require(isinstance(original, str) and (os.path.isabs(original) or original == f"hash:{algorithm}:{expected}"),
            f"Reference needs an absolute original path or hash identity: {original}")
    return {"original": original, "algorithm": algorithm, "expected": expected, "pointer": where}


def discover(data, original):
    """Only declared digests create edges; arbitrary paths/URLs are never crawled.

    Known sibling receipts resolve scalar hashes. Otherwise scalar *Sha256
    fields are hash-only identities, resolved from included/recovery bytes.
    Aggregate sourceSeal values and remote registry integrity without a local
    archive are provenance metadata, not claimed file-payload dependencies.
    """
    refs = []
    root = parse_json(data, original)
    base = Path(original).parent if os.path.isabs(original) else None

    def scalar_target(key, parts, obj):
        explicit = next((obj[name] for name in ("path", "file", "archive", "originalPath")
                         if isinstance(obj.get(name), str) and os.path.isabs(obj[name])), None)
        if key == "sha256" and explicit:
            return explicit
        if base is None:
            return None
        if key == "scheduleSha256":
            return str(base / "schedule.json")
        if key in ("summarySha256", "markdownSha256"):
            return str(base / ("summary.json" if key == "summarySha256" else "summary.md"))
        if key == "planSha256" or key == "packetPlanSha256":
            if Path(original).name in ("build.json", "dispatch-build.json"):
                return str(base / "plan.json")
            if base.name.endswith("-conformance"):
                return str(base.parent / "plan.json")
        if key == "buildSha256" and base.name.endswith("-conformance"):
            return str(base.parent / ("dispatch-build.json" if base.name.startswith("dispatch") else "build.json"))
        if key == "statsSha256" and len(parts) >= 3 and parts[-3] == "arms":
            scenario = "dispatch" if "dispatch" in Path(original).name else "inventory"
            return str(base / str(parts[-2]) / "dist" / scenario / "stats.json")
        if key == "lockSha256" and Path(original).name == "toolchain.json":
            return str(base / "package-lock.json")
        return None

    def visit(value, parts=()):
        if isinstance(value, list):
            for index, item in enumerate(value):
                visit(item, (*parts, index))
            return
        if not isinstance(value, dict):
            return
        for key, item in value.items():
            location = pointer((*parts, key))
            if os.path.isabs(key) and isinstance(item, str):
                if HASH.fullmatch(item):
                    refs.append(reference(key, "sha256", item, location))
                elif parts and parts[-1] in HASH_MAP_NAMES:
                    raise ArchiveError(f"Malformed expected file hash at {original}{location}")
            elif key == "sha256" or key.endswith("Sha256"):
                ref = reference(scalar_target(key, (*parts, key), value), "sha256", item, location)
                if key in JSON_DIGESTS:
                    ref["jsonExpected"] = True
                refs.append(ref)
            elif key == "integrity" and isinstance(value.get("archive"), str):
                match = re.fullmatch(r"(sha256|sha512)-([A-Za-z0-9+/]+={0,2})", str(item))
                require(match is not None, f"Unsupported archive integrity: {original}{location}")
                try:
                    expected = base64.b64decode(match[2], validate=True).hex()
                except ValueError as error:
                    raise ArchiveError(f"Invalid SRI: {location}") from error
                refs.append(reference(value["archive"], match[1], expected, location))
            visit(item, (*parts, key))
    visit(root)
    return sorted(refs, key=lambda item: (item["pointer"], item["original"], item["expected"]))


class Builder:
    def __init__(self, output, recovery):
        self.output = Path(output)
        self.recovery = [Path(path).absolute() for path in recovery]
        self.paths, self.hash_only = deque(), deque()
        self.requested, self.entries, self.payloads = set(), {}, {}
        self.digest_sources = {}
        self.selections, self.opaque = [], set()
        self.recovery_indexed = False

    def enqueue(self, ref, selected=False):
        key = (ref["original"], ref.get("algorithm"), ref.get("expected"), ref.get("jsonExpected", False))
        if selected:
            self.selections.append(dict(ref))
        if key not in self.requested:
            self.requested.add(key)
            (self.hash_only if ref["original"].startswith("hash:") else self.paths).append(ref)

    def select(self, path, expected=None, opaque=False):
        original = os.path.abspath(path)
        if opaque:
            self.opaque.add(original)
        ref = reference(original, "sha256", expected, "selection") if expected else {"original": original}
        self.enqueue(ref, selected=True)

    def index_file(self, path):
        values = file_digests(path)
        for algorithm in ("sha256", "sha512"):
            self.digest_sources.setdefault((algorithm, values[algorithm]), str(path))
        return values

    def recovery_lookup(self, algorithm, expected):
        if (algorithm, expected) in self.digest_sources:
            return self.digest_sources[(algorithm, expected)]
        if not self.recovery_indexed:
            self.recovery_indexed = True
            for root in self.recovery:
                require(root.exists(), f"Missing explicitly supplied recovery root: {root}")
                require(not root.is_symlink(), f"Recovery root must not be a symlink: {root}")
                if root.is_file():
                    self.index_file(root)
                    continue
                require("node_modules" not in root.parts and root.name not in SKIP_RECOVERY,
                        f"Do not crawl dependency/cache recovery trees; select exact files instead: {root}")
                for directory, dirs, files in os.walk(root, followlinks=False):
                    dirs[:] = sorted(name for name in dirs if name not in SKIP_RECOVERY
                                     and not (Path(directory) / name).is_symlink()
                                     and (Path(directory) / name).absolute() != self.output.absolute())
                    for name in sorted(files):
                        candidate = Path(directory) / name
                        if not candidate.is_symlink() and candidate.is_file():
                            self.index_file(candidate)
        found = self.digest_sources.get((algorithm, expected))
        require(found is not None, f"Missing expected payload {algorithm}:{expected}; no matching original or recovery copy")
        return found

    def resolve(self, ref):
        original, expected = ref["original"], ref.get("expected")
        if not original.startswith("hash:") and Path(original).is_file():
            values = self.index_file(original)
            if expected is None or values[ref["algorithm"]] == expected:
                return original
        require(expected is not None, f"Selected input is missing: {original}")
        return self.recovery_lookup(ref["algorithm"], expected)

    def store(self, source, ref):
        staging = self.output / ".payload-in-progress"
        with open(source, "rb") as incoming, open(staging, "xb") as outgoing:
            require(stat.S_ISREG(os.fstat(incoming.fileno()).st_mode), f"Nonregular source: {source}")
            values = digests(incoming, outgoing)
        if ref.get("expected"):
            require(values[ref["algorithm"]] == ref["expected"], f"Input changed while archiving {ref['original']}")
        digest = values["sha256"]
        payload = f"payloads/sha256/{digest}"
        target = self.output / payload
        if target.exists():
            staging.unlink()
        else:
            staging.rename(target)
        self.payloads[digest] = {**values, "path": payload}
        for algorithm in ("sha256", "sha512"):
            self.digest_sources.setdefault((algorithm, values[algorithm]), str(target))
        return values, target

    def build(self):
        require(not self.output.exists(), f"Output must be fresh: {self.output}")
        self.output.mkdir(parents=True)
        (self.output / "payloads" / "sha256").mkdir(parents=True)
        try:
            while self.paths or self.hash_only:
                # Resolve path-bound closure before orphan digest references, so
                # a runnerSha256 can reuse its already-bound source payload.
                ref = (self.paths if self.paths else self.hash_only).popleft()
                source = self.resolve(ref)
                values, payload = self.store(source, ref)
                identity = (ref["original"], values["sha256"])
                if identity in self.entries and (self.entries[identity]["parsedJson"] or not ref.get("jsonExpected")):
                    continue
                is_json = Path(ref["original"]).suffix.lower() == ".json"
                # Typed scalar JSON digests retain their closure even if they
                # have no original path. Never invent a path for that identity.
                json_expected = ref.get("jsonExpected", False)
                opaque = ref["original"] in self.opaque
                require(not (json_expected and opaque), "A typed JSON reference cannot be made opaque")
                parsed = (is_json or json_expected) and not opaque
                refs = discover(payload.read_bytes(), ref["original"]) if parsed else []
                entry = {"original": ref["original"], "sha256": values["sha256"],
                         "resolvedSource": os.path.abspath(source), "opaque": opaque,
                         "jsonExpected": json_expected, "parsedJson": parsed, "references": refs}
                self.entries[identity] = entry
                for child in refs:
                    self.enqueue(child)
            verifier = Path(__file__).read_bytes()
            write_new(self.output / VERIFIER, verifier)
            manifest = {"format": FORMAT, "createdUTC": datetime.now(timezone.utc).isoformat(),
                        "command": [sys.executable, *sys.argv],
                        "verifierSha256": hashlib.sha256(verifier).hexdigest(),
                        "selections": self.selections, "recoveryRoots": [str(path) for path in self.recovery],
                        "entries": sorted(self.entries.values(), key=lambda item: (item["original"], item["sha256"])),
                        "payloads": self.payloads,
                        "limits": ["Integrity, not authenticity or semantic correctness.",
                                   "Only explicit selections and discovered hash-reference closure are included. This is not complete repository history or a reproducible installed/build environment.",
                                   "Paths remain original identities, not extraction destinations. Multiple historical hashes for one original path are preserved separately.",
                                   "Scalar hash-only identities have no invented original path. Explicit opaque inputs are preserved as bytes without reference discovery.",
                                   "Remote registry integrity without a local archive and aggregate sourceSeal metadata are retained as provenance, not followed as file payloads.",
                                   "No source-map URL crawl, dependency installation or automatic node_modules traversal. Maps enter only when explicitly selected or hash-referenced."]}
            data = json_bytes(manifest)
            write_new(self.output / "manifest.json", data)
            write_new(self.output / "manifest.sha256", (hashlib.sha256(data).hexdigest() + "  manifest.json\n").encode())
            verify_source(self.output)
            return manifest
        except Exception as error:
            write_new(self.output / "archive-failure.json", json_bytes({"complete": False, "error": str(error)}))
            raise


def safe_name(name):
    require(isinstance(name, str) and name and "\\" not in name and "\x00" not in name,
            f"Unsafe archive path: {name!r}")
    parts = PurePosixPath(name).parts
    require(not name.startswith("/") and name == "/".join(parts) and all(part not in (".", "..") for part in parts),
            f"Unsafe archive path: {name!r}")
    return name


class Reader:
    def __init__(self, source):
        self.source, self.tar, self.names = Path(source), None, set()
        self.scratch = None
        require(not self.source.is_symlink(), "Archive root must not be a symlink")
        if self.source.is_dir():
            for directory, dirs, files in os.walk(self.source, followlinks=False):
                for name in [*dirs, *files]:
                    path = Path(directory) / name
                    require(not path.is_symlink(), f"Symlink in extracted archive: {path}")
                    if name in files:
                        require(path.is_file(), f"Nonregular archive file: {path}")
                        self.names.add(safe_name(path.relative_to(self.source).as_posix()))
                    else:
                        relative = path.relative_to(self.source).as_posix()
                        require(relative in ("payloads", "payloads/sha256"), f"Unexpected archive directory: {relative}")
        else:
            try:
                # Reference closure revisits payloads in original-path order.
                # Random seeks on gzip repeatedly decompress its prefix. Decode
                # once into a seekable temporary tar, then keep the same member,
                # checksum and reference checks for every access. This bounds
                # decompression to one pass without loading payloads into RAM.
                self.scratch = tempfile.TemporaryFile()
                with tarfile.open(self.source, "r:*") as incoming:
                    incoming.fileobj.seek(0)
                    shutil.copyfileobj(incoming.fileobj, self.scratch)
                self.scratch.seek(0)
                self.tar = tarfile.open(fileobj=self.scratch, mode="r:")
                for member in self.tar.getmembers():
                    name = safe_name(member.name)
                    require(member.isfile(), f"Nonregular tar entry (links/directories prohibited): {name}")
                    require(name not in self.names, f"Duplicate tar entry: {name}")
                    self.names.add(name)
            except Exception:
                self.close()
                raise

    def open(self, name):
        safe_name(name)
        require(name in self.names, f"Missing archived file: {name}")
        if self.tar is not None:
            return self.tar.extractfile(self.tar.getmember(name))
        path = self.source / name
        require(not path.is_symlink() and path.is_file(), f"Unsafe extracted path: {name}")
        return path.open("rb")

    def read(self, name):
        with self.open(name) as stream:
            return stream.read()

    def close(self):
        if self.tar:
            self.tar.close()
        if self.scratch:
            self.scratch.close()


def verify_reader(reader):
    data = reader.read("manifest.json")
    expected_manifest = hashlib.sha256(data).hexdigest() + "  manifest.json\n"
    require(reader.read("manifest.sha256") == expected_manifest.encode(), "Manifest checksum mismatch")
    manifest = parse_json(data, "manifest.json")
    require(manifest.get("format") == FORMAT, "Unknown archive format")
    require(hashlib.sha256(reader.read(VERIFIER)).hexdigest() == manifest.get("verifierSha256"), "Verifier checksum mismatch")
    payloads, entries = manifest.get("payloads"), manifest.get("entries")
    require(isinstance(payloads, dict) and isinstance(entries, list) and entries, "Missing payload manifest")
    expected_names = set(FIXED)
    for digest, record in payloads.items():
        require(HASH.fullmatch(digest) is not None, "Invalid payload hash")
        name = f"payloads/sha256/{digest}"
        require(record.get("path") == name and record.get("sha256") == digest, "Invalid content-addressed path")
        expected_names.add(name)
        with reader.open(name) as stream:
            actual = digests(stream)
        require(all(actual[key] == record.get(key) for key in ("sha256", "sha512", "size")), f"Payload checksum/size mismatch: {name}")
    require(reader.names == expected_names, f"Unexpected or missing archive members: {sorted(reader.names ^ expected_names)}")
    identities, indexed, parsed_identities = set(), set(), set()
    for entry in entries:
        original, digest = entry.get("original"), entry.get("sha256")
        require(isinstance(original, str) and (os.path.isabs(original) or re.fullmatch(r"hash:(sha256:[0-9a-f]{64}|sha512:[0-9a-f]{128})", original)), "Invalid original identity")
        require(digest in payloads and (original, digest) not in identities, "Duplicate/missing entry payload")
        identities.add((original, digest))
        for algorithm in ("sha256", "sha512"):
            indexed.add((original, algorithm, payloads[digest][algorithm]))
            if entry.get("parsedJson"):
                parsed_identities.add((original, algorithm, payloads[digest][algorithm]))
        if original.startswith("hash:"):
            _, algorithm, expected = original.split(":")
            require(payloads[digest][algorithm] == expected, "Hash identity does not match its payload")
        require(isinstance(entry.get("opaque"), bool) and isinstance(entry.get("parsedJson"), bool), "Missing parse policy")
        require(isinstance(entry.get("jsonExpected"), bool), "Missing JSON-reference policy")
        require(not (entry["jsonExpected"] and entry["opaque"]), "Typed JSON reference was made opaque")
        should_parse = (Path(original).suffix.lower() == ".json" or entry["jsonExpected"]) and not entry["opaque"]
        require(entry["parsedJson"] == should_parse, "JSON parse-policy mismatch")
        refs = discover(reader.read(payloads[digest]["path"]), original) if should_parse else []
        require(refs == entry.get("references"), f"Reference closure differs from original JSON: {original}")
    for entry in entries:
        for ref in entry["references"]:
            require((ref["original"], ref["algorithm"], ref["expected"]) in indexed,
                    f"Missing expected archived reference: {ref['original']} {ref['expected']}")
            if ref.get("jsonExpected"):
                require((ref["original"], ref["algorithm"], ref["expected"]) in parsed_identities,
                        f"Typed JSON reference closure was not parsed: {ref['original']}")
    require({digest for _, digest in identities} == set(payloads), "Unmapped payload in archive")
    for selection in manifest.get("selections", []):
        if selection.get("expected"):
            require((selection["original"], selection["algorithm"], selection["expected"]) in indexed, "Missing selected expected version")
        else:
            require(any(original == selection["original"] for original, _ in identities), "Missing selected input")
    require(manifest.get("selections"), "Archive has no explicit selection")
    return manifest


def verify_source(source):
    reader = Reader(source)
    try:
        return verify_reader(reader)
    finally:
        reader.close()


def pack(source, output):
    output = Path(output)
    checksum = Path(str(output) + ".sha256")
    require(not output.exists() and not checksum.exists(), "Archive and sidecar outputs must be fresh")
    reader = Reader(source)
    try:
        verify_reader(reader)
        with output.open("xb") as outgoing, tarfile.open(fileobj=outgoing, mode="w:gz", format=tarfile.PAX_FORMAT) as archive:
            for name in sorted(reader.names):
                with reader.open(name) as incoming:
                    info = tarfile.TarInfo(name)
                    info.size = reader.tar.getmember(name).size if reader.tar else (reader.source / name).stat().st_size
                    info.mode, info.mtime = 0o644, 0
                    archive.addfile(info, incoming)
        verify_source(output)
        write_new(checksum, (file_digests(output)["sha256"] + "  " + output.name + "\n").encode())
    finally:
        reader.close()


def extract(source, output):
    output = Path(output)
    require(not output.exists(), "Extraction output must be fresh")
    reader = Reader(source)
    try:
        verify_reader(reader)
        output.mkdir(parents=True)
        for name in sorted(reader.names):
            target = output / safe_name(name)
            target.parent.mkdir(parents=True, exist_ok=True)
            require(not target.parent.is_symlink(), "Unsafe extraction parent")
            with reader.open(name) as incoming, target.open("xb") as outgoing:
                shutil.copyfileobj(incoming, outgoing)
        verify_source(output)
    finally:
        reader.close()


def create(args):
    builder = Builder(args.output, args.recover)
    for selection in args.selection:
        value = parse_json(Path(selection).read_bytes(), selection)
        require(isinstance(value, dict) and isinstance(value.get("files"), list), "Selection needs a files array")
        builder.select(selection)
        for item in value["files"]:
            require(isinstance(item, dict) and isinstance(item.get("path"), str) and os.path.isabs(item["path"]), "Selection paths must be absolute")
            require(isinstance(item.get("opaque", False), bool), "Invalid opaque selection flag")
            builder.select(item["path"], item.get("sha256"), item.get("opaque", False))
    for path in args.select:
        builder.select(path)
    for path in args.opaque:
        builder.select(path, opaque=True)
    require(builder.selections, "Select at least one input file")
    result = builder.build()
    print(f"Created {len(result['entries'])} original/version mappings and {len(result['payloads'])} unique payloads in {args.output}")


def self_test():
    # Tiny synthetic fixtures only. No real study/toolchain data is read.
    with tempfile.TemporaryDirectory(prefix="signaltree-evidence-self-test-") as temp:
        root = Path(temp)
        source, snapshot = root / "current.ts", root / "snapshot.ts"
        snapshot.write_text("historical source\n")
        expected = file_digests(snapshot)["sha256"]
        source.write_text("current changed source\n")
        historical_plan = root / "historical-plan.json"
        historical_plan.write_bytes(json_bytes({"inputs": {str(source): expected}}))
        receipt = root / "result.json"
        receipt.write_bytes(json_bytes({"packetPlanSha256": file_digests(historical_plan)["sha256"], "runnerSha256": expected}))
        builder = Builder(root / "good", [snapshot, historical_plan])
        builder.select(source)
        builder.select(receipt)
        manifest = builder.build()
        require(any(entry["original"] == str(source) and entry["sha256"] == expected for entry in manifest["entries"]), "Historical recovery was not exercised")
        require(sum(entry["original"] == str(source) for entry in manifest["entries"]) == 2,
                "Current and historical versions of one original path were collapsed")
        # Verification and extraction must work after every original/recovery
        # path is gone, including resolution of the scalar runner hash.
        source.unlink(); snapshot.unlink(); receipt.unlink(); historical_plan.unlink()
        verify_source(root / "good")
        pack(root / "good", root / "good.tar.gz")
        extract(root / "good.tar.gz", root / "extracted")
        verify_source(root / "extracted")
        target = root / "extracted" / f"payloads/sha256/{expected}"
        target.write_text("tampered\n")
        must_fail(lambda: verify_source(root / "extracted"), "tampered payload")
        target.unlink()
        must_fail(lambda: verify_source(root / "extracted"), "missing payload")
        missing = root / "missing.json"
        missing.write_bytes(json_bytes({"bindings": {str(root / "absent.ts"): "a" * 64}}))
        absent = Builder(root / "absent-archive", [])
        absent.select(missing)
        must_fail(absent.build, "missing expected source")
        unsafe = root / "unsafe.tar"
        with tarfile.open(unsafe, "w") as archive:
            info = tarfile.TarInfo("../escape")
            info.size = 1
            archive.addfile(info, io.BytesIO(b"x"))
        must_fail(lambda: extract(unsafe, root / "unsafe-output"), "unsafe tar path")
        require(not (root / "unsafe-output").exists(), "Unsafe extraction created output")
        with tarfile.open(root / "symlink.tar", "w") as archive:
            info = tarfile.TarInfo("manifest.json")
            info.type, info.linkname = tarfile.SYMTYPE, "/etc/passwd"
            archive.addfile(info)
        must_fail(lambda: verify_source(root / "symlink.tar"), "tar symlink")
    print("PASS: tiny synthetic archive, historical hash recovery, original-free verification/extraction, missing/tampered payload rejection, missing expected hash and unsafe path/symlink rejection. No real study archive created.")


def must_fail(work, label):
    try:
        work()
    except (ArchiveError, FileNotFoundError):
        return
    raise ArchiveError(f"Self-test failed to reject {label}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest="command", required=True)
    creation = commands.add_parser("create", help="Create a fresh directory; follows declared hash references only")
    creation.add_argument("output")
    creation.add_argument("--select", action="append", default=[], metavar="FILE")
    creation.add_argument("--opaque", action="append", default=[], metavar="FILE")
    creation.add_argument("--selection", action="append", default=[], metavar="JSON")
    creation.add_argument("--recover", action="append", default=[], metavar="FILE_OR_DIR")
    verification = commands.add_parser("verify", help="Verify a directory or tar without any original temp paths")
    verification.add_argument("source")
    for name in ("pack", "extract"):
        command = commands.add_parser(name)
        command.add_argument("source")
        command.add_argument("output")
    commands.add_parser("self-test")
    args = parser.parse_args()
    if args.command == "create":
        create(args)
    elif args.command == "verify":
        manifest = verify_source(args.source)
        print(f"Verified {len(manifest['entries'])} mappings / {len(manifest['payloads'])} payloads; integrity only, not authenticity.")
    elif args.command == "pack":
        pack(args.source, args.output)
    elif args.command == "extract":
        extract(args.source, args.output)
    else:
        self_test()


if __name__ == "__main__":
    try:
        main()
    except (ArchiveError, OSError, tarfile.TarError) as error:
        print(f"Archive verification failed: {error}", file=sys.stderr)
        sys.exit(1)
