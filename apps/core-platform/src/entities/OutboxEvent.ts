import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

@Entity("outbox_events")
export class OutboxEvent {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar" })
  aggregateType: string;

  @Column({ type: "varchar" })
  aggregateId: string;

  @Column({ type: "varchar" })
  eventType: string;

  @Column({ type: "jsonb" })
  payload: Record<string, unknown>;

  @Column({ type: "boolean", default: false })
  processed: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
