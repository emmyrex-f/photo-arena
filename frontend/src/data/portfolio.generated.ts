export type PortfolioCategory = "birthdays" | "portraits" | "corporate" | "kids" | string;

export type PortfolioImage = {
  id: string;
  src: string;
  alt: string;
  category: PortfolioCategory;
  featured: boolean;
};

/** Extracted from the old site. Replace with originals when available. */
export const portfolioImages: PortfolioImage[] = [
  {
    "id": "pa-01",
    "src": "/gallery/01-birthdays.jpg",
    "alt": "Birthday Photoshoot at Photo Arena",
    "category": "birthdays",
    "featured": true
  },
  {
    "id": "pa-02",
    "src": "/gallery/02-birthdays.jpg",
    "alt": "Birthday Photoshoot at Photo Arena",
    "category": "birthdays",
    "featured": true
  },
  {
    "id": "pa-03",
    "src": "/gallery/03-birthdays.jpg",
    "alt": "Birthday Photoshoot at Photo Arena",
    "category": "birthdays",
    "featured": true
  },
  {
    "id": "pa-04",
    "src": "/gallery/04-birthdays.jpg",
    "alt": "Birthday Photoshoot at Photo Arena",
    "category": "birthdays",
    "featured": true
  },
  {
    "id": "pa-05",
    "src": "/gallery/05-birthdays.jpg",
    "alt": "Birthday Photoshoot at Photo Arena",
    "category": "birthdays",
    "featured": true
  },
  {
    "id": "pa-06",
    "src": "/gallery/06-portraits.jpg",
    "alt": "Professional Portrait at Photo Arena",
    "category": "portraits",
    "featured": true
  },
  {
    "id": "pa-07",
    "src": "/gallery/07-portraits.jpg",
    "alt": "Professional Portrait at Photo Arena",
    "category": "portraits",
    "featured": true
  },
  {
    "id": "pa-08",
    "src": "/gallery/08-portraits.jpg",
    "alt": "Professional Portrait at Photo Arena",
    "category": "portraits",
    "featured": true
  },
  {
    "id": "pa-09",
    "src": "/gallery/09-portraits.jpg",
    "alt": "Professional Portrait at Photo Arena",
    "category": "portraits",
    "featured": false
  },
  {
    "id": "pa-10",
    "src": "/gallery/10-corporate.jpg",
    "alt": "Corporate Headshot at Photo Arena",
    "category": "corporate",
    "featured": false
  },
  {
    "id": "pa-11",
    "src": "/gallery/11-corporate.jpg",
    "alt": "Corporate Headshot at Photo Arena",
    "category": "corporate",
    "featured": false
  },
  {
    "id": "pa-12",
    "src": "/gallery/12-corporate.jpg",
    "alt": "Corporate Headshot at Photo Arena",
    "category": "corporate",
    "featured": false
  },
  {
    "id": "pa-13",
    "src": "/gallery/13-corporate.jpg",
    "alt": "Corporate Headshot at Photo Arena",
    "category": "corporate",
    "featured": false
  },
  {
    "id": "pa-14",
    "src": "/gallery/14-corporate.jpg",
    "alt": "Corporate Headshot at Photo Arena",
    "category": "corporate",
    "featured": false
  },
  {
    "id": "pa-15",
    "src": "/gallery/15-kids.jpg",
    "alt": "Children Photography at Photo Arena",
    "category": "kids",
    "featured": false
  },
  {
    "id": "pa-16",
    "src": "/gallery/16-kids.jpg",
    "alt": "Children Photography at Photo Arena",
    "category": "kids",
    "featured": false
  },
  {
    "id": "pa-17",
    "src": "/gallery/17-kids.jpg",
    "alt": "Children Photography at Photo Arena",
    "category": "kids",
    "featured": false
  },
  {
    "id": "pa-18",
    "src": "/gallery/18-kids.jpg",
    "alt": "Children Photography at Photo Arena",
    "category": "kids",
    "featured": false
  },
  {
    "id": "pa-19",
    "src": "/gallery/19-kids.jpg",
    "alt": "Children Photography at Photo Arena",
    "category": "kids",
    "featured": false
  },
  {
    "id": "pa-20",
    "src": "/gallery/20-kids.jpg",
    "alt": "Children Photography at Photo Arena",
    "category": "kids",
    "featured": false
  },
  {
    "id": "pa-21",
    "src": "/gallery/21-kids.jpg",
    "alt": "Children Photography at Photo Arena",
    "category": "kids",
    "featured": false
  },
  {
    "id": "pa-22",
    "src": "/gallery/22-kids.jpg",
    "alt": "Children Photography at Photo Arena",
    "category": "kids",
    "featured": false
  }
];
