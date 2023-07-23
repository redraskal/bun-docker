import path from "path";
import net from "net";
import os from "os";
import { exists, readdir } from "fs/promises";
import createClient from "openapi-fetch-bun";
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
	const file = Bun.file(path.join(userSettingsDir(), "config.json"));
	if (!(await file.exists())) return null;
	return await file.json<DockerUserConfig>();
}

export async function* contexts() {
	for await (const file of walk(path.join(userSettingsDir(), "contexts"))) {
		if (!file.endsWith("meta.json")) continue;
		yield await Bun.file(file).json<DockerContext>();
	}
}

export async function currentContext() {
	const config = await userConfig();
	if (!config?.currentContext) return null;
	for await (const context of contexts()) {
		if (context.Name == config.currentContext) {
			return context;
		}
	}
	return null;
}

export async function socketPath() {
	let location = "unix:///var/run/docker.sock";
	if (await exists(location)) {
		return location;
	}
	if (await exists("docker.sock")) {
		return "unix://docker.sock";
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

const decoder = new TextDecoder("utf-8");

function unixFetch(unixPath: string) {
	return async function (url: string | URL | Request, init?: RequestInit): Promise<Response> {
		const socket = new net.Socket();
		const promiseSocket = new PromiseSocket(socket);
		await promiseSocket.connect(unixPath);
		const requestHeaders = init?.headers
			? Object.entries(init.headers)
					.map(([key, value]) => `${key}: ${value}`)
					.join("\r\n")
			: "\r\n";
		const jsonBody = init?.body ? (init.body as string) : null;
		const content = init?.body
			? `Content-Type: application/json\r\nContent-Length: ${jsonBody?.length}\r\n\r\n${jsonBody}`
			: "";
		await promiseSocket.write(
			`${init?.method || "GET"} ${url} HTTP/1.0\r\nHost: localhost\r\n${requestHeaders}${content}\r\n`
		);
		// TODO: figure out Docker stream responses
		const buf = (await promiseSocket.read()) as Buffer;
		const body = decoder.decode(buf).split("\r\n\r\n");
		const headers =
			body
				.shift()
				?.split("\r\n")
				?.map((header) => header.split(": ") as [string, string]) || [];
		const status = headers.shift()![0].split(" ") || [];
		const response = new Response(body[0], {
			status: Number(status[1]),
			statusText: status[2],
			headers: headers,
		});
		return response;
	};
}

/**
 * @param version API version (specify if you do not use the latest version)
 */
export default async function createDockerClient<Paths extends {} = paths>(version?: string) {
	const unixPath = await socketPath();
	if (!unixPath) {
		throw new Error("Docker unix socket not found");
	}
	return createClient<Paths>({
		baseUrl: `/${version ? version + "/" : ""}`,
		fetch: unixFetch(unixPath),
	});
}
