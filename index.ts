import path from "path";
import net from "net";
import os from "os";
import { readdir } from "fs/promises";
import createClient from "openapi-fetch";
import PromiseSocket from "promise-socket";
import { paths } from "./latest";

type DockerUserConfig = {
	currentContext?: string;
};

type DockerContext = {
	Name: string;
	Metadata: {
		Description: string;
	};
	Endpoints: {
		docker: {
			Host: string;
			SkipTLSVerify: boolean;
		};
	};
};

export function userSettingsDir() {
	return path.join(os.homedir(), ".docker");
}

export async function userConfig() {
	return await Bun.file(path.join(userSettingsDir(), "config.json")).json<DockerUserConfig>();
}

export async function* contexts() {
	for await (const file of walk(path.join(userSettingsDir(), "contexts"))) {
		if (!file.endsWith("meta.json")) continue;
		yield await Bun.file(file).json<DockerContext>();
	}
}

export async function currentContext() {
	const config = await userConfig();
	if (!config.currentContext) return null;
	for await (const context of contexts()) {
		if (context.Name == config.currentContext) {
			return context;
		}
	}
	return null;
}

export async function socketPath() {
	let location = "unix:///var/run/docker.sock";
	if (await Bun.file(location).exists()) {
		return location;
	}
	return (await currentContext())?.Endpoints.docker.Host;
}

async function* walk(directory: string): AsyncGenerator<string> {
	for await (const child of await readdir(directory, { withFileTypes: true })) {
		const joined = path.join(directory, child.name);
		if (child.isDirectory()) {
			yield* walk(joined);
		} else {
			yield joined;
		}
	}
}

const unixPath = await socketPath();
const decoder = new TextDecoder("utf-8");

async function unixFetch(url: string | URL | Request, init?: RequestInit): Promise<Response> {
	const socket = new net.Socket();
	const promiseSocket = new PromiseSocket(socket);
	await promiseSocket.connect(unixPath!);
	const requestHeaders = init?.headers ? Object.entries(init.headers)
		.map(([key, value]) => `${key}: ${value}`).
		join("\r\n") : "\r\n";
	await promiseSocket.write(`${init?.method || "GET"} ${url} HTTP/1.0\r\nHost: localhost\r\n${requestHeaders}\r\n`);
	const buf = await promiseSocket.read() as Buffer;
	const body = decoder.decode(buf).split("\r\n\r\n");
	const headers = body.shift()?.split("\r\n")?.map(header => header.split(": ") as [string, string]) || [];
	const status = headers.shift()![0].split(" ") || [];
	const response = new Response(body[0], {
		status: Number(status[1]),
		statusText: status[2],
		headers: headers,
	});
	return response;
}

/**
 * @param version API version (specify if you do not use the latest version)
 */
export default function createDockerClient<Paths extends {} = paths>(version?: string) {
	if (!unixPath) {
		throw new Error("Docker unix socket not found");
	}
	return createClient<Paths>({
		baseUrl: `/${version ? version + "/" : ""}`,
		fetch: unixFetch,
	});
};