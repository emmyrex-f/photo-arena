import { Link } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { formatPublishDate } from "../lib/datetime";
import { fetchBlogList, mediaUrl } from "../lib/publicApi";
import { Seo } from "../lib/seo";
import { usePublicData } from "../lib/usePublicData";

export function BlogPage() {
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
          {loading ? <p className="text-text-secondary">Loading…</p> : null}
          {!loading && posts.length === 0 ? (
            <div className="mx-auto max-w-lg text-center">
              <p className="font-display text-3xl text-text">Nothing published yet.</p>
              <p className="mt-stack text-text-secondary">
                Check back soon, or follow along on Instagram while we write the first notes.
              </p>
              <Link to="/portfolio" className="mt-stack-lg inline-block text-sm text-accent hover:text-accent-hover">
                Browse the portfolio
              </Link>
            </div>
          ) : null}
          {posts.length > 0 ? (
            <ul className="grid gap-stack-xl md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <li key={post.id}>
                  <Link to={`/blog/${post.slug}`} className="group block">
                    {post.coverImageUrl ? (
                      <img
                        src={mediaUrl(post.coverImageUrl)}
                        alt=""
                        className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:opacity-90"
                      />
                    ) : (
                      <div className="aspect-[4/3] w-full bg-surface" />
                    )}
                    <p className="mt-4 text-xs uppercase tracking-[0.16em] text-text-muted">
                      {post.publishedAt ? formatPublishDate(post.publishedAt) : null}
                    </p>
                    <h2 className="mt-2 font-display text-2xl text-text group-hover:text-accent-hover">
                      {post.title}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-text-secondary">{post.excerpt}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </Container>
      </Section>
    </>
  );
}
