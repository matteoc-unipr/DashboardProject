#!/usr/bin/env node

const axios = require("axios");
const fs = require("fs");
const AdmZip = require("adm-zip");

const core = require("@actions/core");

const DATA_PROVIDER = process.env.DATA_PROVIDER;
const UI_FRAMEWORK = process.env.UI_FRAMEWORK;
const USER_AGENT = process.env.CI_USER_AGENT;
const FRAMEWORK = process.env.FRAMEWORK;

const buildRemote = async () => {
    const dataProviderMap = {
        "custom-json-rest": ["keycloak", "custom"],
        "strapi-v4": "strapi",
        "nestjsx-crud": ["google", "custom"],
        airtable: ["auth0", "custom"],
        supabase: "supabase",
        appwrite: "appwrite",
        hasura: ["keycloak", "custom"],
    };

    const uiFrameworkToExampleMap = {
        antd: "antd-example",
        mui: "mui-example",
        no: "headless-example",
        tailwindcss: "headless-example",
    };

    let AUTH_PROVIDER = dataProviderMap[DATA_PROVIDER];

    if (Array.isArray(AUTH_PROVIDER)) {
        const randomIndex = Math.floor(Math.random() * AUTH_PROVIDER.length);
        AUTH_PROVIDER = AUTH_PROVIDER[randomIndex];
    }

    console.log(
        "Creating boilerplate for: ",
        FRAMEWORK,
        DATA_PROVIDER,
        AUTH_PROVIDER,
        UI_FRAMEWORK,
    );

    const body = {
        projectName: "refine-project",
        type: `refine-${FRAMEWORK}`,
        name: "refine-project",
        answers: {
            title: "refine Project",
            theme: "Blue",
            icon: "refine.svg",
            "data-provider": `data-provider-${DATA_PROVIDER}`,
            "ui-framework": UI_FRAMEWORK,
            [uiFrameworkToExampleMap[UI_FRAMEWORK]]:
                uiFrameworkToExampleMap[UI_FRAMEWORK],
            "auth-provider": `auth-provider-${AUTH_PROVIDER}`,
        },
    };

    if (["react", "vite"].includes(FRAMEWORK)) {
        body.answers["router-provider"] = "react-router";
    }

    const createdBoilerplate = await axios.post(
        "https://develop.cloud.refine.dev/.refine/boilerplates",
        body,
        {
            headers: {
                "Content-Type": "application/json",
                "User-Agent": USER_AGENT,
            },
        },
    );

    const waitUntilBoilerplateReady = async (id) => {
        return new Promise((resolve, reject) => {
            const interval = setInterval(async () => {
                const boilerplate = await axios.get(
                    `https://develop.cloud.refine.dev/.refine/boilerplates/${id}`,
                    {
                        headers: {
                            "Content-Type": "application/json",
                            "User-Agent": USER_AGENT,
                        },
                    },
                );

                if (boilerplate.data.status === "ready") {
                    clearInterval(interval);
                    resolve(boilerplate);
                }
            }, 2000);
        });
    };

    const readyBoilerplate = await waitUntilBoilerplateReady(
        createdBoilerplate.data.id,
    );

    console.log("Boilerplates ready");

    const { downloadString } = readyBoilerplate.data;

    console.log("Boilerplate download string: ", downloadString);

    const downloadURL = `https://develop.cloud.refine.dev/.refine/d/${downloadString}`;

    const examplePath = "tmp/examples";

    const zipPath = `${downloadString}.zip`;

    const downloadZip = async () => {
        return new Promise((resolve, reject) => {
            axios
                .get(downloadURL, { responseType: "stream" })
                .then((response) => {
                    console.log("Downloading boilerplate");
                    response.data.pipe(fs.createWriteStream(zipPath));
                    response.data.on("end", (data) => {
                        console.log(data);
                        setTimeout(() => {
                            console.log("Downloaded boilerplate");
                            resolve();
                        }, 1000);
                    });
                })
                .catch((err) => {
                    console.log("Error downloading boilerplate");
                    reject(err);
                });
        });
    };

    await downloadZip();

    const zip = new AdmZip(zipPath);

    fs.mkdirSync(`${examplePath}/${downloadString}`, { recursive: true });

    zip.extractAllTo(`${examplePath}/${downloadString}`, true);

    core.setOutput("auth_provider", AUTH_PROVIDER);
    core.setOutput("project_path", `${examplePath}/${downloadString}`);
};

buildRemote().then(() => {
    console.log("Completed");
});
