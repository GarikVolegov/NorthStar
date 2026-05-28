import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ComposePostCard, PostCard } from "./SocialPanels";
import type { SocialPost } from "./socialTypes";

const basePost: SocialPost = {
  id: 1,
  userId: 10,
  content: "Nuovo progetto pubblicato",
  visibility: "public",
  createdAt: new Date().toISOString(),
  author: {
    id: 10,
    name: "Ada Lovelace",
  },
};

describe("PostCard", () => {
  it("renders attached image media", () => {
    render(
      <PostCard
        post={{ ...basePost, mediaUrl: "https://cdn.example.com/post.jpg", mediaType: "image" }}
        currentUserId={20}
        onDelete={() => {}}
      />,
    );

    expect(screen.getByAltText("Media del post")).toHaveAttribute("src", "https://cdn.example.com/post.jpg");
  });

  it("renders attached video media", () => {
    render(
      <PostCard
        post={{ ...basePost, mediaUrl: "https://cdn.example.com/post.mp4", mediaType: "video" }}
        currentUserId={20}
        onDelete={() => {}}
      />,
    );

    expect(screen.getByLabelText("Video del post")).toHaveAttribute("src", "https://cdn.example.com/post.mp4");
  });

  it("renders media description and hashtags", () => {
    render(
      <PostCard
        post={{
          ...basePost,
          mediaUrl: "data:image/png;base64,abc",
          mediaType: "image",
          mediaDescription: "Schermata del prototipo",
          hashtags: ["ux", "portfolio"],
        }}
        currentUserId={20}
        onDelete={() => {}}
      />,
    );

    expect(screen.getByText("Schermata del prototipo")).toBeInTheDocument();
    expect(screen.getByText("#ux")).toBeInTheDocument();
    expect(screen.getByText("#portfolio")).toBeInTheDocument();
  });

  it("uses gallery upload controls instead of a media URL field", () => {
    render(
      <ComposePostCard
        currentUser={{ id: 1, name: "Ada Lovelace" }}
        postText=""
        setPostText={() => {}}
        visibility="public"
        setVisibility={() => {}}
        isPending={false}
        error={null}
        onCreate={() => {}}
      />,
    );

    expect(screen.getByLabelText("Carica media dalla galleria")).toHaveAttribute("type", "file");
    expect(screen.getByPlaceholderText("Descrizione del media")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Hashtag, separati da virgola")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("URL immagine o video")).not.toBeInTheDocument();
  });
});
