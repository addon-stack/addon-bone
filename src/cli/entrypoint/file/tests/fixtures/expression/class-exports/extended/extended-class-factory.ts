import {BaseService} from "../../helpers/class-for-test";

class Service extends BaseService {
    public getUserRoute(): string {
        return this.apiUrl + '/user';
    }

    fetchUserData<T>(endpoint: string): Promise<T> {
        return this.fetchData<T>(endpoint);
    }
}

export default () => {
    return new Service();
}
