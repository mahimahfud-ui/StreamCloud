import nodeAssert from "node:assert/strict";
import {
  isAmbiguousMovieMatch,
  normalizeTitle,
  parseMovieQuery,
  rankMovieCandidates,
  scoreMovieCandidate,
} from "../movie-availability/search-utils.ts";

Deno.test("movie query parser extracts years and explicit media type", () => {
  nodeAssert.deepEqual(parseMovieQuery("Dune (2021)"), {
    title: "Dune", year: 2021, mediaType: null,
  });
  nodeAssert.deepEqual(parseMovieQuery("series: The Office (2005)"), {
    title: "The Office", year: 2005, mediaType: "tv",
  });
  nodeAssert.deepEqual(parseMovieQuery("movie: Spider-Man: No Way Home"), {
    title: "Spider-Man: No Way Home", year: null, mediaType: "movie",
  });
  nodeAssert.deepEqual(parseMovieQuery("The Bear series"), {
    title: "The Bear", year: null, mediaType: "tv",
  });
  nodeAssert.equal(parseMovieQuery("Dune (2201)").year, null);
});

Deno.test("title normalizer preserves non-Latin titles and normalizes punctuation", () => {
  nodeAssert.equal(normalizeTitle("Spider-Man: No Way Home"), "spider man no way home");
  nodeAssert.equal(normalizeTitle("Amélie & Friends"), "amelie and friends");
  nodeAssert.ok(normalizeTitle("অপরাজিত").length > 0);
});

Deno.test("ranking prefers exact title and matching release year", () => {
  const rows = [
    { id: 1, title: "Dune: Part Two", original_title: "Dune: Part Two", release_date: "2024-02-27", vote_count: 5000, popularity: 100 },
    { id: 2, title: "Dune", original_title: "Dune", release_date: "2021-09-03", vote_count: 4000, popularity: 70 },
    { id: 3, title: "Dune", original_title: "Dune", release_date: "1984-12-14", vote_count: 1000, popularity: 30 },
  ];
  const ranked = rankMovieCandidates(rows, "movie", "Dune", 2021);
  nodeAssert.equal(ranked[0].id, 2);
  nodeAssert.equal(ranked[0].year, "2021");
  nodeAssert.equal(ranked[0].score, 115);
  nodeAssert.ok(ranked.find((candidate) => candidate.id === 3)!.score < ranked[0].score);
});

Deno.test("ranking recognises common typos and original titles", () => {
  const score = scoreMovieCandidate({ title: "Oppenheimer", originalTitle: "Oppenheimer", year: "2023" }, "Oppenhimer");
  nodeAssert.ok(score >= 68, "minor title typo should remain a viable candidate");
  const ranked = rankMovieCandidates([
    { id: 11, title: "Your Name", original_title: "君の名は。", release_date: "2016-08-26", vote_count: 100 },
    { id: 12, title: "Name", original_title: "Name", release_date: "2020-01-01", vote_count: 10 },
  ], "movie", "君の名は。", null);
  nodeAssert.equal(ranked[0].id, 11);
});

Deno.test("duplicate movie/series titles are flagged as ambiguous without a year", () => {
  const ranked = rankMovieCandidates([
    { id: 101, title: "The Office", original_title: "The Office", release_date: "2005-03-24", vote_count: 500 },
    { id: 102, title: "The Office", original_title: "The Office", release_date: "2001-07-09", vote_count: 300 },
  ], "movie", "The Office", null);
  nodeAssert.equal(isAmbiguousMovieMatch(ranked), true);
  const yearRanked = rankMovieCandidates([
    { id: 101, title: "The Office", original_title: "The Office", release_date: "2005-03-24", vote_count: 500 },
    { id: 102, title: "The Office", original_title: "The Office", release_date: "2001-07-09", vote_count: 300 },
  ], "movie", "The Office", 2005);
  nodeAssert.equal(yearRanked[0].id, 101);
  nodeAssert.equal(isAmbiguousMovieMatch(yearRanked), false);
});
