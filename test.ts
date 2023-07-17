import createDockerClient from ".";

const { get } = createDockerClient();
const { data, error } = await get("/info", {});

console.log(data);
console.log(error);
