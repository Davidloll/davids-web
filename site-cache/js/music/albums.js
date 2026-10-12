export function renderAlbums({ $, activeQuery, albumResults, fallback, openAlbum }) {
  $("music-library").hidden = true;
  $("music-results").hidden = false;
  $("results-title").textContent = activeQuery ? `albums for “${activeQuery}”` : "albums";
  $("music-results").replaceChildren(
    ...albumResults.map((album) => {
      const card = document.createElement("article");
      card.className = "music-track";
      const button = document.createElement("button");
      button.className = "album-cover";
      button.setAttribute("aria-label", `Open album ${album.title}`);
      const image = document.createElement("img");
      image.src = album.cover || "/png/logo.png";
      image.alt = "";
      image.loading = "lazy";
      fallback(image);
      button.append(image);
      button.onclick = () => openAlbum(album);
      const name = document.createElement("strong");
      name.className = "track-title";
      name.textContent = album.title;
      const artist = document.createElement("span");
      artist.className = "track-artist";
      artist.textContent = album.artist;
      card.append(button, name, artist);
      return card;
    }),
  );
}
