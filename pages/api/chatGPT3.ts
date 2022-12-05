import type { NextApiRequest, NextApiResponse } from "next";
import { Chatbot } from "../../lib/chatGPT3";

const SESSION_TOKEN = process.env.SESSION_TOKEN;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{
    message: string;
    conversation_id: string;
    parent_id: string;
  }>
) {
  // get the prompt from the response
  const prompt = req.body.prompt;
  const conversationId = req.body.conversation_id ?? null;
  const parentId = req.body.parent_id ?? null;
  console.log("CONVEERSATION", conversationId);
  console.log("PARENT", parentId);

  if (!prompt) {
    console.log(req.body);
    res.status(400).json({
      message: "No prompt provided",
      conversation_id: "",
      parent_id: "",
    });
    return;
  }

  const api = new Chatbot(
    {
      Authorization: null,
      session_token: SESSION_TOKEN,
    },
    conversationId,
    parentId
  );
  await api.refreshSession();
  const response = await api.get_chat_response(prompt);
  console.log(response);
  res.status(200).json({ ...response });
}
