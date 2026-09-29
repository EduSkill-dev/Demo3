import type { TourWithClub } from "@/types/database";

export const DEMO_TOURS: TourWithClub[] = [
  {
    id: "d1", club_id: "c1", club_name: "Yerevan Trail Collective",
    title: "Արագած՝ հարավային գագաթ", region: "Արագածոտն", date: "2026-10-04",
    description: "Օրական արշավ դեպի Արագածի հարավային գագաթ։ Դժվարություն՝ բարձր։ Հավաքը՝ առավոտյան 6:00։",
    max_participants: 14, photo_urls: [], type: "mountain", overnight: false, difficulty: "medium", popular: false, created_at: "",
  },
  {
    id: "d2", club_id: "c2", club_name: "Dilijan Wanders",
    title: "Դիլիջանի անտառային շրջագայություն", region: "Տավուշ", date: "2026-10-05",
    description: "Հեշտ արշավ Դիլիջանի ազգային պարկում՝ անտառ, աղբյուրներ, տեսարաններ։",
    max_participants: 20, photo_urls: [], type: "other", overnight: false, difficulty: "medium", popular: false, created_at: "",
  },
  {
    id: "d3", club_id: "c3", club_name: "Southern Trails",
    title: "Խուստուփ՝ 2 օր, գիշերակացով", region: "Սյունիք", date: "2026-10-11",
    description: "Երկօրյա վերելք Խուստուփ՝ վրաններով գիշերակացով։ Պահանջվում է սարքավորում։",
    max_participants: 12, photo_urls: [], type: "mountain", overnight: true, difficulty: "medium", popular: false, created_at: "",
  },
  {
    id: "d4", club_id: "c4", club_name: "Lori Ramblers",
    title: "Դեբեդի կիրճ", region: "Լոռի", date: "2026-10-12",
    description: "Միջին բարդության արշավ Դեբեդի կիրճով, վանական համալիրների այցով։",
    max_participants: 16, photo_urls: [], type: "other", overnight: false, difficulty: "medium", popular: false, created_at: "",
  },
  {
    id: "d5", club_id: "c5", club_name: "Sevan Explorers",
    title: "Սևանի ափով՝ վրանային գիշերակաց", region: "Գեղարքունիք", date: "2026-10-18",
    description: "Արշավ Սևանա լճի ափով և գիշերակաց լճի մոտ։",
    max_participants: 18, photo_urls: [], type: "lake", overnight: true, difficulty: "medium", popular: false, created_at: "",
  },
  {
    id: "d6", club_id: "c6", club_name: "Vayots Explorers",
    title: "Ջերմուկի ջրվեժներ", region: "Վայոց ձոր", date: "2026-10-19",
    description: "Հեշտ արշավ Ջերմուկի ջրվեժների և լճակների շուրջ։",
    max_participants: 20, photo_urls: [], type: "lake", overnight: false, difficulty: "medium", popular: false, created_at: "",
  },
];
