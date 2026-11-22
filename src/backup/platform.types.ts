import type { Reader, Writer, Operation } from './format';
import type { BackupFiles } from './service';
export interface Staged {
    name: string;
    open(): Promise<Reader>;
    dispose(): Promise<void>;
}
export interface Target {
    name: string;
    create(): Promise<{
        writer: Writer;
        reader: () => Promise<Reader>;
    }>;
    confirmation: string;
    finish(): Promise<void>;
    discard(): Promise<void>;
}
export interface BackupPlatform {
    files: BackupFiles;
    pick(): Promise<Staged | null>;
    stage(source: Staged, op: Operation): Promise<Staged>;
    target(): Promise<Target | null>;
    safetyCopies(): Promise<string[]>;
    safety(name: string): Promise<Staged>;
}
