export type Testimonial = {
  id: string;
  quote: string;
  name: string;
  approved: boolean;
};

/**
 * Old-site quotes are stored for later review only.
 * They are not approved for publication and must not be rendered.
 */
export const testimonials: Testimonial[] = [];

export const hasApprovedTestimonials = testimonials.some((item) => item.approved);
