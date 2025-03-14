// src/content/contentScript.tsx
import ReactDOM from "react-dom";
import "@/styles/main.css";
import Content from "@/content/content";
import { Idea } from "@/types/idea";

const hostId = "my-extension-host";
let host = document.getElementById(hostId);

if (!host) {
  host = document.createElement("div");
  host.id = hostId;
  host.style.position = "fixed";
  host.style.top = "10px";
  host.style.right = "10px";
  host.style.zIndex = "10000";
  document.body.appendChild(host);
}

const shadow = host.shadowRoot || host.attachShadow({ mode: "open" });

const containerId = "my-root";
let container = shadow.querySelector(`#${containerId}`);

if (!container) {
  container = document.createElement("div");
  container.id = containerId;
  container.className = "my-extension-root";
  shadow.appendChild(container);
}

if (!shadow.querySelector("link[href*='main.css']")) {
  const styleLink = document.createElement("link");
  // Print all the files in the dist folder

  styleLink.rel = "stylesheet";
  styleLink.href = chrome.runtime.getURL("styles/main.css");
  console.log(chrome.runtime.getURL("styles/main.css"));
  shadow.appendChild(styleLink);
}

ReactDOM.render(<Content />, container);

// Example of how to communicate with the background script
export async function generateIdeas(): Promise<Idea[]> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "GENERATE_IDEAS" }, (response) => {
      console.log("Response from background script:", response);
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      if (response.success) {
        resolve(response.data as Idea[]);
      } else {
        reject(response.error);
      }
    });
  });
}

export async function getSession() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "GET_SESSION" }, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      if (response.success) {
        resolve(response.token);
      } else {
        reject(response.error);
      }
    });
  });
}
