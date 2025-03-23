// src/content/contentScript.tsx
import ReactDOM from "react-dom";
import "@/styles/main.css";
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
  shadow.appendChild(styleLink);
}

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

// Function to create a post on Substack
export async function createSubstackPost(
  message: string,
  scheduleSeconds: number = 0,
  autoCloseTab: boolean = true
): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: "API_REQUEST",
        action: "createSubstackPost",
        params: [message, scheduleSeconds, autoCloseTab],
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        if (response.success) {
          resolve(response.data);
        } else {
          reject(response.error);
        }
      }
    );
  });
}

window.addEventListener("message", function (event) {
  console.log("Message from content script:", event);
  if (event.source !== window) return; // we only care about messages from our own page
  if (!event.data) return;

  // Now forward it to the background script
  chrome.runtime.sendMessage(event.data, function (response) {
    console.log("Background script responded:", response);
  });
});
