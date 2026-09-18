import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { CreateEnquiryDto, NewsletterDto } from "./dto/public.dto";
import { PublicService } from "./public.service";

@Controller("public")
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get("settings")
  settings() {
    return this.publicService.settings();
  }

  @Get("services")
  services() {
    return this.publicService.services();
  }

  @Get("gallery")
  gallery() {
    return this.publicService.gallery();
  }

  @Get("testimonials")
  testimonials() {
    return this.publicService.testimonials();
  }

  @Get("faqs")
  faqs() {
    return this.publicService.faqs();
  }

  @Get("blog")
  blog(@Query("page") page?: string, @Query("pageSize") pageSize?: string, @Query("tag") tag?: string) {
    return this.publicService.blogList(page, pageSize, tag);
  }

  @Get("blog/:slug")
  blogOne(@Param("slug") slug: string) {
    return this.publicService.blogBySlug(slug);
  }

  @Post("enquiries")
  enquiries(@Body() body: CreateEnquiryDto) {
    return this.publicService.createEnquiry(body);
  }

  @Post("newsletter")
  newsletter(@Body() body: NewsletterDto) {
    return this.publicService.subscribeNewsletter(body.email, body.source);
  }
}
