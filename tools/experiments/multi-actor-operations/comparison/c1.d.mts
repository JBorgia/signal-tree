type Actor = {
    kind: 'unknown';
} | {
    kind: 'declared';
    label: string;
};
type Proposal = {
    entityId: string;
    patch: Record<string, string | number>;
    expected: Record<string, number>;
};
type Status = 'draft' | 'reviewed' | 'approved' | 'delivering' | 'uncertain' | 'succeeded' | 'failed' | 'rejected';
type Receipt = {
    commandId: string;
    status: 'applied' | 'rejected';
    reason?: string;
};
type Review = {
    operationId: string;
    revision: number;
    actor: Actor;
    proposal: Proposal;
};
type Command = Review & {
    commandId: string;
};
type Attempt = {
    operationId: string;
    revision: number;
    attemptId: string;
};
type Row = {
    id: string;
    revision: number;
    actor: Actor;
    proposal: Proposal;
    status: Status;
    attempts: number;
    receipt?: Receipt;
    error?: string;
};
type Transport = {
    apply(command: Readonly<Command>, context: Readonly<Attempt>): unknown | Promise<unknown>;
};
export declare class SignalTreeApp {
    #private;
    constructor(transport: Transport);
    inspect(id: string): Readonly<Row>;
    create(id: string, proposal: Proposal, actor?: Actor): void;
    revise(id: string, proposal: Proposal): void;
    review(id: string): Readonly<Review>;
    approve(binding: Readonly<Review>): void;
    reject(id: string): void;
    deliver(id: string): Promise<Readonly<Row>>;
    forget(id: string): void;
    dispose(): void;
}
export {};
