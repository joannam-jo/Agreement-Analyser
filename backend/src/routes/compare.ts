import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { getAgreementForUser } from "../services/storage.service";
import { AppError } from "../middleware/errorHandler";
import type { CompareResult } from "@faa/shared";

const schema = z.object({
  agreementIdA: z.string().uuid(),
  agreementIdB: z.string().uuid(),
});

export const compareRouter = Router();

compareRouter.post("/", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { agreementIdA, agreementIdB } = schema.parse(req.body);
    const agreementA = await getAgreementForUser(agreementIdA, req.userId!);
    const agreementB = await getAgreementForUser(agreementIdB, req.userId!);

    if (!agreementA || !agreementB) throw new AppError(404, "One or both agreements not found");

    if (agreementA.documentCheck?.isAgreement === false || agreementB.documentCheck?.isAgreement === false) {
      throw new AppError(400, 'One of these files is not an agreement, so it cannot be compared.');
    }
    // Only like with like: a student loan has different norms from a personal loan or a lease.
    const kindA = agreementA.documentCheck?.agreementKind ?? 'unknown';
    const kindB = agreementB.documentCheck?.agreementKind ?? 'unknown';
    if (kindA !== kindB) {
      throw new AppError(400, 'These are different kinds of agreement (' + kindA.replace('-', ' ') + ' and ' + kindB.replace('-', ' ') + '). Compare documents of the same kind, such as two education loans.');
    }

    const trustDelta = agreementA.scores.trustScore - agreementB.scores.trustScore;
    const riskDelta = agreementA.scores.overallRisk - agreementB.scores.overallRisk;

    let saferAgreement: "a" | "b" | "tie" = "tie";
    if (agreementA.scores.trustScore > agreementB.scores.trustScore + 5) saferAgreement = "a";
    else if (agreementB.scores.trustScore > agreementA.scores.trustScore + 5) saferAgreement = "b";

    const keyDifferences: string[] = [];
    if (Math.abs(trustDelta) > 10) {
      keyDifferences.push(
        `Trust score differs by ${Math.abs(trustDelta)} points (${saferAgreement === "a" ? "A" : "B"} is safer).`
      );
    }
    keyDifferences.push(
      `Agreement A: ${agreementA.riskCounts.high} high-risk vs Agreement B: ${agreementB.riskCounts.high} high-risk clauses.`
    );

    const result: CompareResult = {
      agreementA,
      agreementB,
      comparison: { trustDelta, riskDelta, saferAgreement, keyDifferences },
    };

    res.json(result);
  } catch (e) {
    next(e);
  }
});
