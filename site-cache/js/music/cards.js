import { verified } from "/js/music/artist-name.js";
export function renderCards({ $, list, library, fallback, action, openTrack, start, saveLike, openPlaylistDialog, addQueue, libraryView, selectedPlaylist, changeLibrary }) {
  $("music-results").replaceChildren(
    ...list.map((track) => {
      const card = document.createElement("article");
      card.className = "music-track";
      card.dataset.trackId = track.id;
      const cover = document.createElement("div");
      cover.className = "track-cover";
      const image = document.createElement("img");
      image.src = track.cover || "/png/logo.png";
      image.alt = "";
      image.loading = "lazy";
      fallback(image);
      image.onclick = () => openTrack(track);
      const playButton = action("play", `Play ${track.title} by ${track.artist}`, () => {
        start(list, list.findIndex((item) => item.id === track.id));
      });
      playButton.className = "track-play";
      playButton.disabled = Boolean(track.unavailable);
      if (track.unavailable) {
        playButton.title = "YouTube Music restricts playback of this song";
        card.classList.add("track-unavailable");
      } else if (track.preview) {
        playButton.title = "Plays a 30-second preview";
        card.classList.add("track-preview");
      }
      const actions = document.createElement("div");
      actions.className = "track-actions";
      const liked = library.isLiked(track.id);
      const heart = action("heart", `${liked ? "Unlike" : "Like"} ${track.title}`, () =>
        saveLike(track),
      );
      heart.dataset.likeId = String(track.id);
      heart.dataset.likeTitle = track.title;
      heart.setAttribute("aria-pressed", String(liked));
      actions.append(
        heart,
        action("playlist", `Add ${track.title} to playlist`, () => openPlaylistDialog(track)),
        action("queue", `Add ${track.title} to queue`, () => addQueue(track)),
      );
      cover.append(image, playButton, actions);
      const caption = document.createElement("button"),
        title = document.createElement("span"),
        artist = document.createElement("span");
      title.className = "track-title";
      title.textContent = track.title;
      artist.className = "track-artist";
      artist.textContent = track.unavailable
        ? `${track.artist}, unavailable`
        : track.preview
          ? `${track.artist}, preview`
          : track.artist;
      verified(artist, track.artistVerified);
      caption.append(title, artist);
      caption.className = "track-caption";
      caption.type = "button";
      caption.setAttribute("aria-label", `Details for ${track.title}`);
      caption.onclick = () => openTrack(track);
      card.append(cover, caption);
      if (libraryView === "playlist")
        actions.append(
          action("trash", `Remove ${track.title} from playlist`, () =>
            changeLibrary(() => library.remove(selectedPlaylist, track.id), "Removed from playlist"),
          ),
        );
      return card;
    }),
  );
}
