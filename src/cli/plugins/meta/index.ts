import {definePlugin} from "@main/plugin";

import Author from "./Author";
import Homepage from "./Homepage";
import Incognito from "./Incognito";
import SpecificSettings from "./SpecificSettings";

export {Author, Homepage, Incognito, SpecificSettings};

export default definePlugin(() => {
    return {
        name: "adnbn:meta",
        manifest: ({manifest, config}) => {
            manifest
                .setAuthor(Author.value(config))
                .setHomepage(Homepage.value(config))
                .setIncognito(Incognito.value(config))
                .setSpecific(SpecificSettings.value(config));
        },
    };
});
