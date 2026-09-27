process.env.ADNBN_ENV_CONFIG_SNAPSHOT = JSON.stringify(
    Object.fromEntries(
        Object.entries(process.env).filter(
            ([key]) => key.startsWith("ADNBN_ENV_") || ["APP", "BROWSER", "MODE", "MANIFEST_VERSION"].includes(key)
        )
    )
);

export default {
    browser: process.env.ADNBN_ENV_SWITCH ? "firefox" : "chrome",
    mode: process.env.ADNBN_ENV_SWITCH ? "production" : "development",
    manifestVersion: process.env.ADNBN_ENV_SWITCH ? 2 : 3,
};
