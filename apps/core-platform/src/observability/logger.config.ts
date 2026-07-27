import { format, transports } from "winston";

export const winstonConfig = {
  transports: [
    new transports.Console({
      format: format.combine(
        format.timestamp(),
        format.json(),
      ),
    }),
  ],
};
