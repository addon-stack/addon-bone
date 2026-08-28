import UserService from "../../helpers/class-for-test-export-default";

class Service extends UserService {
    public getUserName(): string {
        return "User " + this.name;
    }
}

export default () => {
    return new Service('bob', 1, 'admin');
}
