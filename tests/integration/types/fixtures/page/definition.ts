import {definePage} from "adnbn";
import type {PageDefinition, PageProps, PermissionsOptions} from "adnbn";

const definition: PageDefinition = {
    name: "reports",
    permissions: ["storage"],
    optionalPermissions: ["downloads"],
    hostPermissions: ["https://api.example.com/*"],
    optionalHostPermissions: ["https://export.example.com/*"],
    csp: {sources: {connect: ["https://api.example.com"]}},
    render: props => {
        const permissions: PermissionsOptions = props;

        return permissions.permissions?.join(", ") ?? "Reports";
    },
};

definePage(definition);

const props: PageProps = {permissions: ["storage"], hostPermissions: ["https://api.example.com/*"]};
definePage(props);
