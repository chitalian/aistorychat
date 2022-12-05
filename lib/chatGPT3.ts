import { v4 as uuidv4 } from "uuid";

export class Chatbot {
  config: { Authorization: string | null; session_token: string };
  conversation_id: string | null;
  parent_id: string;
  headers: any;

  constructor(
    config: { Authorization: string | null; session_token: string },
    conversation_id: string | null = null,
    parent_id: string | null = null
  ) {
    this.config = config;
    this.conversation_id = conversation_id;
    this.parent_id = parent_id === null ? this.generate_uuid() : parent_id;
    this.refresh_headers();
  }

  refresh_headers() {
    this.headers = {
      Accept: "application/json",
      Authorization: "Bearer " + this.config["Authorization"],

      "Content-Type": "application/json",
    };
  }

  generate_uuid() {
    return uuidv4();
  }

  async refreshSession(): Promise<void> {
    if (!this.config.session_token) {
      throw new Error("No session token provided");
    }
    const headers = new Headers();
    headers.append(
      "Cookie",
      `__Secure-next-auth.session-token=${this.config.session_token}`
    );
    try {
      // Make request
      const response = await fetch("https://chat.openai.com/api/auth/session", {
        headers: headers,
      });
      const json = await response.json();
      // console.log("HEADERS", response);

      const cookies = response.headers.get("set-cookie");

      const sessionToken =
        cookies
          ?.split(";")
          .find((cookie) => cookie.includes("__Secure-next-auth.session-token"))
          ?.split("=")[1] ?? "";

      const accessToken = json.accessToken;
      this.config.session_token = sessionToken;
      this.config["Authorization"] = accessToken;
      this.refresh_headers();
    } catch (e) {
      console.log("Error refreshing session");
    }
  }

  async get_chat_response(
    prompt: string,
    output: string = "text"
  ): Promise<{ message: string; conversation_id: string; parent_id: string }> {
    let data = {
      action: "next",
      messages: [
        {
          id: this.generate_uuid(),
          role: "user",
          content: { content_type: "text", parts: [prompt] },
        },
      ],
      conversation_id: this.conversation_id,
      parent_message_id: this.parent_id,
      model: "text-davinci-002-render",
    };
    if (output == "text") {
      let response = await fetch(
        "https://chat.openai.com/backend-api/conversation",
        {
          method: "POST",
          headers: this.headers,
          body: JSON.stringify(data),
        }
      );

      try {
        let responseLines = (await response.text()).split("\n");
        console.log("[1/6] RESPONSE LINES", responseLines);
        let lastLine = responseLines[responseLines.length - 5];
        console.log("[2/6] LAST LINE", lastLine);
        let responseJson = JSON.parse(lastLine.slice(6));
        console.log("[3/6] RESPONSE JSON", responseJson);
        this.parent_id = responseJson["message"]["id"];
        console.log("[4/6] PARENT ID", this.parent_id);
        this.conversation_id = responseJson["conversation_id"];
        console.log("[5/6] CONVERSATION ID", this.conversation_id);
        let message = responseJson["message"]["content"]["parts"][0];
        console.log("[6/6] MESSAGE", message);
        return {
          message: message,
          conversation_id: this.conversation_id!,
          parent_id: this.parent_id,
        };
      } catch (error) {
        console.error(await response.text());
        throw new Error("Response is not in the correct format");
      }
    } else {
      throw new Error("Output must be either 'text' or 'response'");
    }
  }
}
