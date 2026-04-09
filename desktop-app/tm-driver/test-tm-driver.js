const net = require("net");
const readline = require("readline");

const address = process.env.TM_DRIVER_ADDR || "127.0.0.1:47047";
const [host, portText] = address.split(":");
const port = Number(portText);

if (!host || !Number.isInteger(port)) {
  throw new Error("Invalid TM_DRIVER_ADDR. Expected host:port");
}

let nextId = 1;
const pending = new Map();

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const socket = net.createConnection({ host, port });

  await new Promise((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("error", reject);
  });

  const rl = readline.createInterface({ input: socket });

  rl.on("line", (line) => {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch (err) {
      console.error("Bad JSON from driver:", line);
      return;
    }

    const req = pending.get(msg.id);
    if (!req) return;

    pending.delete(msg.id);
    if (msg.error) req.reject(new Error(msg.error));
    else req.resolve(msg.result);
  });

  socket.on("error", (err) => {
    console.error("Socket error:", err.message);
  });

  function call(method, params = {}) {
    const id = nextId++;
    const payload = JSON.stringify({ id, method, params }) + "\n";
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      socket.write(payload, (err) => {
        if (err) {
          pending.delete(id);
          reject(err);
        }
      });
    });
  }

  try {
    console.log("Connected to tm-driver at", address);

    console.log("ping =>", await call("ping"));

    const pos = await call("getMouseLocation");
    console.log("getMouseLocation =>", pos);

    console.log("Left click in 2 seconds...");
    await delay(2000);
    console.log("click(left) =>", await call("click", { button: "left" }));

    console.log("Right click in 2 seconds...");
    await delay(2000);
    console.log("click(right) =>", await call("click", { button: "right" }));

    console.log("Middle click in 2 seconds...");
    await delay(2000);
    console.log("click(middle) =>", await call("click", { button: "middle" }));

    console.log("Press-and-release test in 2 seconds...");
    await delay(2000);
    console.log("mouseDown(left) =>", await call("mouseDown", { button: "left" }));
    await delay(150);
    console.log("mouseUp(left) =>", await call("mouseUp", { button: "left" }));

    console.log("Done.");
  } finally {
    rl.close();
    socket.end();
  }
}

main().catch((err) => {
  console.error("Test failed:", err.message);
  process.exitCode = 1;
});