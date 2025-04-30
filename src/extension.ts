import * as vscode from 'vscode';
import axios from 'axios';
import { marked } from 'marked';
import * as fs from 'fs';
import * as path from 'path';

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const configuration = vscode.workspace.getConfiguration('kimiChat');
var KIMI_API_URL = configuration.get<string>('apiUrl') || 'https://api.moonshot.cn/v1/chat/completions';
var KIMI_API_KEY = configuration.get<string>('apiKey');

if (!KIMI_API_KEY) {
	vscode.window.showErrorMessage('Please set the Kimi API key in the settings.');
}

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('kimiChatView', new KimiChatViewProvider(context))
    );
}

class KimiChatViewProvider implements vscode.WebviewViewProvider {
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    resolveWebviewView(webviewView: vscode.WebviewView) {
        webviewView.webview.options = {
            enableScripts: true
        };

        // Load the HTML content from the file
        const htmlPath = path.join(this.context.extensionPath, 'src', 'webview.html');
        const htmlContent = fs.readFileSync(htmlPath, 'utf8');

        webviewView.webview.html = htmlContent;

		// Listen for messages from the webview
		webviewView.webview.onDidReceiveMessage(async (message) => {
			if (message.command === 'sendPrompt') {
				const prompt = message.text;
	
				try {
					// Call getKimiResponse and send the response back to the webview
					const response = await getKimiResponse(prompt);
					webviewView.webview.postMessage({ command: 'receiveResponse', response });
				} catch (error) {
					vscode.window.showErrorMessage(`Error: ${error}`);
					webviewView.webview.postMessage({ command: 'receiveResponse', response: 'An error occurred while processing your request.' });
				}
			}
		});
	
    }
}

function getKimiResponse(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
		KIMI_API_KEY = configuration.get<string>('apiKey');
        if (!KIMI_API_KEY) {
            reject(new Error('API Key is not configured.'));
            return;
        }

        axios.post(
            KIMI_API_URL,
            {
                model: "moonshot-v1-8k",
                messages: [
                    { role: "user", content: prompt },
                ],
                temperature: 0.3,
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${KIMI_API_KEY}`,
                },
            }
        )
            .then((response) => {
                if (response.data.choices && response.data.choices.length > 0) {
                    const assistantMessage = response.data.choices[0].message.content;
                    const htmlResponse = marked.parse(assistantMessage);
                    resolve(htmlResponse);
                } else {
                    reject(new Error('No choices available in the response.'));
                }
            })
            .catch((error) => {
                reject(error);
            });
    });
}

export function deactivate() { }