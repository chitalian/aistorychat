/* eslint-disable @next/next/no-img-element */
import Head from "next/head";
import Image from "next/image";
import { useEffect, useState } from "react";
import styles from "../styles/Home.module.css";

function LoadingSpinner() {
  return (
    <div role="status">
      <svg
        aria-hidden="true"
        className="mr-2 w-8 h-8 text-gray-200 animate-spin dark:text-gray-600 fill-blue-300"
        viewBox="0 0 100 101"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
          fill="currentColor"
        />
        <path
          d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
          fill="currentFill"
        />
      </svg>
      <span className="sr-only">Loading...</span>
    </div>
  );
}

interface IChatMessage {
  parent_id: string;
  conversation_id: string | null;
  message: string;
  image_url: string | null;
  image_prompt: string | null;
}

function getStartingPrompt(input: string): string {
  return `
You are a text video game where you give me options (A, B, C, D) as my choices. Add a section before each choice describing the events as "Event". Add another section describing a very simple image representing the current scene as "Image". 

Here is an example output

Event: {event}

Image: {image description}

Options:
A: {option A}
B: {option B}
C: {option C}
D: {option D}

The scene is ${input}. I start out with 100 health. What is my first set of Event Image and options?
`;
}

export default function Home() {
  const [scene, setScene] = useState("");
  const [chatHistory, setChatHistory] = useState<IChatMessage[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [shifted, setShifted] = useState(false);

  useEffect(() => {
    window.scrollTo(0, document.body.scrollHeight);
  }, [chatHistory]);

  function extraImageData(prompt: string): string {
    const imgPrompt = prompt.split("Image: ")[1].split("\n")[0] as string;
    return imgPrompt;
  }
  async function getImageUrl(imagePrompt: string): Promise<string> {
    //sleep for 3 seconds
    await new Promise((r) => setTimeout(r, 8000));
    const { jobId: imageJobId } = await (
      await fetch("/api/queueImage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: {
            prompt: `Within the world of ${scene}, ${imagePrompt}`,
          },
        }),
      })
    ).json();
    const { url: image_url } = await (
      await fetch(`/api/imageResult`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobId: imageJobId,
        }),
      })
    ).json();
    return image_url;
  }

  function cleanUpPrompt(prompt: string, imagePrompt: string): string {
    return prompt
      .replace(`Image: ${imagePrompt}`, "")
      .replace("Event: ", "")
      .replace("\n\n", "\n")
      .replace("\n\n", "\n");
  }

  async function getResponse(): Promise<void> {
    const chatGPT3Data: IChatMessage = await (
      await fetch("/api/chatGPT3", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: currentInput,
          conversation_id: chatHistory[chatHistory.length - 1].conversation_id,
          parent_id: chatHistory[chatHistory.length - 1].parent_id,
        }),
      })
    ).json();
    const imagePrompt = extraImageData(chatGPT3Data.message);
    const currentSize = chatHistory.length;
    getImageUrl(imagePrompt).then((image_url) =>
      setChatHistory((prev) => {
        const newChatHistory = [...prev];
        newChatHistory[currentSize].image_url = image_url;
        console.log("updated new chat history", newChatHistory);
        return newChatHistory;
      })
    );

    const messageWithoutImage = cleanUpPrompt(
      chatGPT3Data.message,
      imagePrompt
    );

    setChatHistory((prev) => [
      ...prev,
      {
        ...chatGPT3Data,
        message: `You have choose "${currentInput}"\n\n${messageWithoutImage}`,
        image_prompt: imagePrompt,
      },
    ]);
  }
  async function getInitialResponse() {
    const chatGPT3Data = await (
      await fetch("/api/chatGPT3", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: getStartingPrompt(currentInput),
        }),
      })
    ).json();
    console.log("chatGPT3Data", chatGPT3Data);

    const imagePrompt = extraImageData(chatGPT3Data.message);
    const image_url = await getImageUrl(imagePrompt);

    const messageWithoutImage = cleanUpPrompt(
      chatGPT3Data.message,
      imagePrompt
    );

    setChatHistory((prev) => [
      ...prev,
      {
        ...chatGPT3Data,
        message: `${messageWithoutImage}`,
        image_url,
        image_prompt: imagePrompt,
      },
    ]);
  }

  function submitRequestToBackend() {
    setIsLoading(true);
    setCurrentInput("");
    if (scene === "") {
      setScene(currentInput);

      getInitialResponse().then(() => {
        setIsLoading(false);
      });
    } else {
      getResponse().then(() => {
        setIsLoading(false);
      });
    }
  }

  return (
    <div className="dark:bg-black dark:text-slate-200">
      <Head>
        <title>AI Story Chat</title>
        <meta name="description" content="AI generated stories" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      {/* Make a text box that always stays on the bottom tailwind*/}
      <main className="flex flex-col w-full flex-1 text-center min-h-screen ">
        <h1 className="fixed top-0 text-center text-4xl font-bold w-full dark:bg-black bg-white py-5">
          {scene === "" ? "AI Story Chat" : `Welcome to ${scene}`}
        </h1>
        <div className="flex flex-col-reverse w-full flex-1 text-center my-40 overflow-auto gap-5 justify-center items-center">
          {chatHistory
            .slice()
            .reverse()
            .map((chatMessage) => (
              <div
                key={chatMessage.conversation_id}
                className="flex flex-col w-5/6 whitespace-pre-wrap text-left border-2 p-5 justify-center items-center"
              >
                {chatMessage.image_url === null ||
                chatMessage.image_url === "" ||
                chatMessage.image_url === undefined ? (
                  <div className="h-[500px] w-[500px] flex flex-col justify-center items-center">
                    <LoadingSpinner />
                  </div>
                ) : (
                  <img
                    src={chatMessage.image_url}
                    width={500}
                    height={500}
                    alt={chatMessage.image_prompt ?? ""}
                  />
                )}
                <i className="text-xs my-2">{chatMessage.image_prompt}</i>

                <text>{chatMessage.message}</text>
              </div>
            ))}
        </div>
        <div className="fixed bottom-0 w-full pb-5 pt-2 dark:bg-black bg-white flex flex-col gap-3">
          <div className="flex flex-row justify-center gap-2 mx-auto w-full">
            <textarea
              disabled={isLoading}
              className="w-1/2 h-30 border-2 bg-transparent px-2 border-black dark:border-slate-200 resize-none"
              placeholder={
                scene === ""
                  ? "Enter the scene you want your story to take place. Ex (Harry Potter, Pokemon, Studio Ghibli) "
                  : isLoading
                  ? "Loading... this might take a while..."
                  : "Select one of the options and hit enter or the send button"
              }
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyUp={(k) => {
                if (k.key === "Shift") {
                  setShifted(false);
                }
              }}
              onKeyDown={(k) => {
                if (k.key === "Shift") {
                  setShifted(true);
                } else if (k.key === "Enter" && !shifted) {
                  k.preventDefault();
                  submitRequestToBackend();
                }
              }}
            />
            <button
              disabled={isLoading}
              className="w-20 h-20 border-2 border-black dark:border-slate-200"
              onClick={() => {
                submitRequestToBackend();
              }}
            >
              {isLoading ? (
                <div className="flex flex-col justify-center items-center">
                  <LoadingSpinner />
                </div>
              ) : (
                "Send"
              )}
            </button>
          </div>
          <div className="flex flex-row gap-5">
            <a href="https://twitter.com/justinstorre">
              <i>twitter</i>
            </a>
            <a href="https://github.com/chitalian/aistorychat">
              <i>github</i>
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
