import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { Container } from "../components/ui/Container";
import { CameraSpinner } from "../components/ui/CameraSpinner";
import { Section } from "../components/ui/Section";
import { formatPublishDate } from "../lib/datetime";
import { fetchBlogPost, mediaUrl, type BlogPost } from "../lib/publicApi";
import { Seo } from "../lib/seo";

export function BlogPostPage() {
  const { slug = "" } = useParams();
  const [post, setPost] = useState<BlogPost | null | undefined>(undefined);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPost(undefined);
    setOffline(false);
    fetchBlogPost(slug)
      .then((result) => {
        if (!cancelled) setPost(result);
      })
      .catch(() => {
        if (!cancelled) {
          setOffline(true);
          setPost(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (post === undefined) {
    return (
      <Section>
        <Container>
          <CameraSpinner label="Loading article" caption="Loading…" />
        </Container>
      </Section>
    );
  }

  if (!post) {
    return (
      <>
        <Seo title="Post not found" noIndex />
        <Section>
          <Container className="max-w-xl text-center">
            <h1 className="font-display text-4xl">{offline ? "Journal unavailable" : "Post not found"}</h1>
            <p className="mt-stack text-text-secondary">
              {offline
                ? "We couldn’t reach the blog API. Please try again later."
                : "That article isn’t published (or the link is wrong)."}
            </p>
            <Link to="/blog" className="mt-stack-lg inline-block text-accent hover:text-accent-hover">
              Back to journal
            </Link>
          </Container>
        </Section>
      </>
    );
  }

  return (
    <>
      <Seo
        title={post.title}
        description={post.excerpt}
        path={`/blog/${post.slug}`}
        image={post.coverImageUrl ?? undefined}
        type="article"
        publishedTime={post.publishedAt ?? undefined}
      />
      <article>
        <PageHeader
          eyebrow="Journal"
          title={post.title}
          description={post.publishedAt ? formatPublishDate(post.publishedAt) : undefined}
        />
        {post.coverImageUrl ? (
          <Container className="max-w-4xl pt-stack-xl">
            <img src={mediaUrl(post.coverImageUrl)} alt="" className="w-full object-cover" />
          </Container>
        ) : null}
        <Section>
          <Container className="prose-pa max-w-2xl">
            <ReactMarkdown>{post.content}</ReactMarkdown>
          </Container>
        </Section>
      </article>
    </>
  );
}
