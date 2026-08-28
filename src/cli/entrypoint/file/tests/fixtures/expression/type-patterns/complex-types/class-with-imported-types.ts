import {UserInfo, UserInfoWithDetails, UserAndDetails} from "../../helpers/types-for-test";

class UserService {
    public getUserInfo(): UserInfo {
        return {id: 1, name: 'Jack'};
    }

    public getUserDetails(): UserInfoWithDetails {
        return {id: 2, name: 'Jack'};
    }

    public getUserAndDetails(): UserAndDetails {
        return {id: 2, name: 'Jack'};
    }
}

export default () => new UserService();
