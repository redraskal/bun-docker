import createDockerClient from ".";

const { get } = createDockerClient();
const { data, error } = await get("/containers/{id}/logs", {
    params: {
        path: {
            id: "5",
        },
        query: {
            follow: true,
        }
    },
});

console.log(data);
console.log(error);
