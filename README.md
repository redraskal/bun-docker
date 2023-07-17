# bun-docker

TypeScript Docker API for Bun using unix sockets.

- API generated with [openapi-typescript](https://github.com/drwpow/openapi-typescript)
- Supports [colima](https://github.com/abiosoft/colima) for macOS/Linux

[Latest Docker API spec](https://docs.docker.com/engine/api/latest)

```ts
import createDockerClient from "bun-docker";

const { get } = createDockerClient();
const { data, error } = await get("/info", {});

console.log(data);
console.log(error);
```

```bash
bun i redraskal/bun-docker#main
```

This project was created using `bun init` in bun v0.6.15. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
