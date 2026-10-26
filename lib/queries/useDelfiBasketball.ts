import { useQuery } from "@tanstack/react-query";

// Delfi ametlikku API-t pole. See on sama sisemine GraphQL, mida sport.delfi.ee ise kasutab:
// võtit ei vaja ja CORS lubab brauserist kutsuda. Skeem pole dokumenteeritud ega introspekteeritav,
// nii et kui Delfi seda muudab, viskab queryFn vea ja vidin näitab veateadet.
const DELFI_GRAPHQL_URL = "https://content.api.delfi.ee/content/v3/graphql";
const BASKETBALL_CATEGORY_ID = 24172545;
const ARTICLE_LIMIT = 10;
const CATEGORY_NAME = "korvpall";

export const DELFI_BASKETBALL_URL = `https://sport.delfi.ee/kategooria/${BASKETBALL_CATEGORY_ID}/${CATEGORY_NAME}`;

const ARTICLES_QUERY = `query DashboardDelfiBasketball($id: [Int!], $limit: Int) {
  articles: getArticles(input: { category: { id: $id }, pager: { limit: $limit, orderBy: PUBLISH_AT } }) {
    items {
      id
      slug
      publishAt
      content {
        title { text }
        paywall { enabled }
      }
      primaryCategory { name }
      metaImage { id type }
    }
  }
}`;

export interface DelfiArticle {
  id: number;
  url: string;
  title: string;
  /** Pealkirja ees olnud rubriik ("VIDEO | ...") lausekujul: "Video". */
  tag: string | null;
  /** Alamrubriik (NBA, Eesti jne); peakategooria "Korvpall" jäetakse välja. */
  category: string | null;
  publishedAt: string;
  paywall: boolean;
  imageId: string | null;
}

interface RawArticle {
  id?: unknown;
  slug?: unknown;
  publishAt?: unknown;
  content?: {
    title?: { text?: unknown } | null;
    paywall?: { enabled?: unknown } | null;
  } | null;
  primaryCategory?: { name?: unknown } | null;
  metaImage?: { id?: unknown; type?: unknown } | null;
}

function sentenceCase(text: string): string {
  const lower = text.toLocaleLowerCase("et-EE");
  return lower.charAt(0).toLocaleUpperCase("et-EE") + lower.slice(1);
}

// Delfi paneb rubriigi pealkirja ette suurtähtedega: "DELFI VIDEO | Pärnu pidi ...".
// Eesliide eraldatakse ainult siis, kui see on lühike ja täielikult suurtähtedega,
// et pealkiri, milles "|" on lihtsalt sisu osa, jääks puutumata.
function splitTitle(raw: string): { tag: string | null; title: string } {
  const separator = raw.indexOf("|");
  if (separator < 2 || separator > 30) return { tag: null, title: raw };

  const prefix = raw.slice(0, separator).trim();
  const rest = raw.slice(separator + 1).trim();
  // Vähemalt üks täht ja kõik tähed suured (numbrid ja märgid ei muutu kummaski suunas).
  const isUppercaseLabel =
    prefix === prefix.toLocaleUpperCase("et-EE") && prefix !== prefix.toLocaleLowerCase("et-EE");
  if (!rest || !isUppercaseLabel) return { tag: null, title: raw };

  return { tag: sentenceCase(prefix), title: rest };
}

function toArticle(raw: RawArticle): DelfiArticle[] {
  const { id, slug, publishAt } = raw;
  const rawTitle = raw.content?.title?.text;
  if (
    typeof id !== "number" ||
    !Number.isInteger(id) ||
    typeof slug !== "string" ||
    !slug ||
    typeof publishAt !== "string" ||
    Number.isNaN(Date.parse(publishAt)) ||
    typeof rawTitle !== "string" ||
    !rawTitle.trim()
  ) {
    return [];
  }

  const { tag, title } = splitTitle(rawTitle.trim());
  const categoryName = raw.primaryCategory?.name;
  const category =
    typeof categoryName === "string" && categoryName.trim() && categoryName.trim().toLowerCase() !== CATEGORY_NAME
      ? categoryName.trim()
      : null;
  const image = raw.metaImage;

  return [
    {
      id,
      url: `https://sport.delfi.ee/artikkel/${id}/${encodeURIComponent(slug)}`,
      title,
      tag,
      category,
      publishedAt: publishAt,
      paywall: raw.content?.paywall?.enabled === true,
      imageId: image?.type === "IMAGE" && typeof image.id === "string" && image.id ? image.id : null,
    },
  ];
}

/** Delfi pildilõikur: laius pikslites, kõrgus 16:9 järgi. */
export function delfiImageUrl(imageId: string, width: number): string {
  const height = Math.round((width * 9) / 16);
  return `https://images.delfi.ee/media-api-image-cropper/v1/${encodeURIComponent(imageId)}.jpg?noup&w=${width}&h=${height}`;
}

export function useDelfiBasketball() {
  return useQuery({
    queryKey: ["delfi-basketball"],
    queryFn: async ({ signal }): Promise<DelfiArticle[]> => {
      const res = await fetch(DELFI_GRAPHQL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: ARTICLES_QUERY,
          variables: { id: [BASKETBALL_CATEGORY_ID], limit: ARTICLE_LIMIT },
        }),
        signal,
      });
      if (!res.ok) throw new Error(`Delfi vastas koodiga ${res.status}`);

      const json = await res.json();
      const items: unknown = json?.data?.articles?.items;
      if (!Array.isArray(items)) {
        const message = json?.errors?.[0]?.message;
        throw new Error(typeof message === "string" ? message : "Delfi vastus oli ootamatu kujuga");
      }

      return (items as RawArticle[]).flatMap(toArticle);
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
  });
}
