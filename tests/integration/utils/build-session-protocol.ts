export interface BuildSessionRequest {
    id: number;
    rootDir: string;
    browser: string;
    manifestVersion: 2 | 3;
    environment: NodeJS.ProcessEnv;
}

export interface BuildSessionFailure {
    name: string;
    message: string;
    cause?: BuildSessionFailure;
    stats?: string;
}

export interface BuildSessionSample {
    pid: number;
    build: number;
    rootDir: string;
    cwd: string;
    rss: number;
    heapUsed: number;
    maxRssKiB: number;
}

export interface BuildSessionResponse {
    id: number;
    error?: BuildSessionFailure;
    sample: BuildSessionSample;
}
