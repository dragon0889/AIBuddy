import { BadRequestException, Body, Controller, Post } from "@nestjs/common";
import { ageInYears, createChildProfile, transition, type ConsentEvent, type ConsentState } from "@aibuddy/shared";

/**
 * Skeleton chỉ minh họa máy trạng thái (chưa có DB/OTP).
 * Production: lưu `consent_events` append-only, kiểm tra OTP, rate-limit (xem docs/DESIGN.md §3.1).
 */
@Controller("api/v1/consent")
export class ConsentController {
  @Post("preview")
  preview(@Body() body: { birthYear: number; birthMonth: number; events?: ConsentEvent["type"][] }) {
    if (!Number.isInteger(body?.birthYear) || !Number.isInteger(body?.birthMonth)) {
      throw new BadRequestException("birthYear and birthMonth are required integers");
    }
    let state: ConsentState = createChildProfile(ageInYears(body.birthYear, body.birthMonth, new Date()));
    try {
      for (const type of body.events ?? []) state = transition(state, { type } as ConsentEvent);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    return state;
  }
}
