type Config = {
  codaApiToken: string;
};

export const config: Config = {
  codaApiToken: process.env.CODA_API_TOKEN!,
};
