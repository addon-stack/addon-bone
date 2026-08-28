export interface UserInfo {
    id: number;
    name: string;
}

export interface UserData {
    reg: number;
    log: number;
}

export interface UserInfoWithDetails extends UserInfo {
    address?: string;
    age?: number;
    data?: UserData;
}

export type UserAndDetails = UserInfo & UserInfoWithDetails;