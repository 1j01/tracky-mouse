const { spawn } = require("child_process");
const path = require("path");
const readline = require("readline");

const exePath = process.env.TM_NATIVE_PATH || path.join(__dirname, "tm-native.exe");
const child = spawn(exePath, [], { stdio: ["pipe", "pipe", "inherit"] });

const rl = readline.createInterface({ input: child.stdout });

rl.on("line", (line) => {
	console.log("response:", line);
	rl.close();
	child.kill();
});

child.on("error", (error) => {
	console.error("failed to start tm-native:", error.message);
	process.exitCode = 1;
});

child.stdin.write(JSON.stringify({ id: 1, cmd: "click", button: "left" }) + "\n");
