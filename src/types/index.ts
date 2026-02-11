import { AnimeGenres, AnimeStatuses, AnimeTypes, FilterOrderEnum } from "../constants";

export type AnimeStatus = typeof AnimeStatuses[number];
export type AnimeType = typeof AnimeTypes[number];
export type AnimeGenre = typeof AnimeGenres[number];
export type FilterOrderType = keyof typeof FilterOrderEnum;
export type FilterAnimeResults = SearchAnimeResults

export interface PartialAnimeData {
    title: string
    cover: string
    synopsis: string
    rating: string
    id: string
    type: AnimeType
    url: string
}

export interface SearchAnimeResults {
    previousPage: string | null
    nextPage: string | null
    foundPages: number
    data: PartialAnimeData[]
}

export interface AnimeData {
    title: string
    alternative_titles: string[]
    status: AnimeStatus
    rating: string
    type: AnimeType
    cover: string
    synopsis: string
    genres: AnimeGenre[]
    episodes: EpisodeData[]
    url: string
}

export interface EpisodeData {
    number: number
    url: string
}

export interface ChapterData {
    title: string
    chapter: number
    cover: string
    url: string
}

export interface AnimeOnAirData {
    title: string
    type: AnimeType
    id: string
    url: string
}
export interface FilterOptions {
    genres?: AnimeGenre[]
    types?: AnimeType[]
    statuses?: AnimeStatus[]
    order?: FilterOrderType
}