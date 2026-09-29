import {Compiler} from "@rspack/core";

export const watch = (compiler: Compiler) => {
    const watching = compiler.watch(
        {
            aggregateTimeout: 300,
            ignored: /node_modules/,
        },
        (err, stats) => {
            if (err) {
                console.error("Rspack watch error:", err);
                process.exit(1);
            }

            if (stats?.hasErrors()) {
                console.error(
                    stats.toString({
                        colors: true,
                        errors: true,
                    })
                );

                return;
            }

            console.log(stats?.toString({colors: true}));
        }
    );

    process.on("SIGINT", () => {
        watching.close(() => {
            console.log("Rspack watch mode stopped");
            process.exit(0);
        });
    });
};
