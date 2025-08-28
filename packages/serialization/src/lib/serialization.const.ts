/**
 * Type markers for special value serialization
 */
export const TYPE_MARKERS = {
  UNDEFINED: '__undefined__',
  NAN: '__nan__',
  INFINITY: '__infinity__',
  NEG_INFINITY: '__neg_infinity__',
  BIGINT: '__bigint__',
  SYMBOL: '__symbol__',
  DATE: '__date__',
  REGEXP: '__regexp__',
  MAP: '__map__',
  SET: '__set__',
  CIRCULAR: '__circular__',
} as const;
