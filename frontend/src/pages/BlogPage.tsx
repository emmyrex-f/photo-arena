import { Link } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { Container } from "../components/ui/Container";
import { CameraSpinner } from "../components/ui/CameraSpinner";
import { Section } from "../components/ui/Section";
import { formatPublishDate } from "../lib/datetime";
import { fetchBlogList, mediaUrl, type BlogPostSummary } from "../lib/publicApi";
import { Seo } from "../lib/seo";
import { useSiteInfo } from "../lib/settings";
import { usePublicData } from "../lib/usePublicData";

function postBlurb(post: BlogPostSummary): string {
  const fromPreview = post.preview?.trim();
  if (fromPreview) return fromPreview;
  const fromExcerpt = post.excerpt?.trim();
  if (fromExcerpt) return fromExcerpt;
  return "";
}

export function BlogPage() {
  const info = useSiteInfo();
  const { data, loading } = usePublicData(() => fetchBlogList(1, 12), []);
  const posts = data?.items ?? [];

  return (
    <>
      <Seo
        title="Journal"
        description="Notes from Photo Arena — sessions, tips, and studio life in Port Harcourt."
        path="/blog"
      />
      <PageHeader
        eyebrow="Journal"
        title="From the studio"
        description="Short reads when we publish them. Quiet when we don’t."
      />
      <Section>
        <Container>
          {loading ? <CameraSpinner label="Loading journal" caption="Loading…" /> : null}
          {!loading && posts.length === 0 ? (
            <div className="mx-auto max-w-lg text-center">
              <p className="font-display text-3xl text-text">Nothing published yet.</p>
              <p className="mt-stack text-text-secondary">
                Check back soon
                {info.instagram ? (
                  <>
                    , or{" "}
                    <a
                      href={info.instagram}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent underline-offset-2 hover:underline"
                    >
                      follow along on Instagram
                    </a>{" "}
                    while we write the first notes
                  </>
                ) : null}
                .
              </p>
              <Link to="/portfolio" className="mt-stack-lg inline-block text-sm text-accent hover:text-accent-hover">
                Browse the portfolio
              </Link>
            </div>
          ) : null}
          {posts.length > 0 ? (
            <ul className="grid gap-x-grid gap-y-stack-xl sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => {
                const blurb = postBlurb(post);
                return (
                  <li key={post.id}>
                    <Link to={`/blog/${post.slug}`} className="group flex h-full flex-col">
                      <div className="overflow-hidden bg-surface">
                        {post.coverImageUrl ? (
                          <img
                            src={mediaUrl(post.coverImageUrl)}
                            alt=""
                            className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.02] group-hover:opacity-90"
                          />
                        ) : (
                          <div className="aspect-[4/3] w-full bg-elevated" />
                        )}
                      </div>
                      <div className="flex flex-1 flex-col pt-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-text-muted">
                          {post.publishedAt ? formatPublishDate(post.publishedAt) : "Draft"}
                        </p>
                        <h2 className="mt-2 font-display text-2xl leading-snug text-text transition-colors group-hover:text-accent-hover">
                          {post.title}
                        </h2>
                        {blurb ? (
                          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-text-secondary">
                            {blurb}
                          </p>
                        ) : null}
                        <span className="mt-auto pt-3 text-xs font-subtitle uppercase tracking-[0.14em] text-accent">
                          Read more
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </Container>
      </Section>
    </>
  );
}
