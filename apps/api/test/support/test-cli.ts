import { Test, type TestingModule } from '@nestjs/testing';

import { CliModule } from '../../src/cli.module';
import { Clock } from '../../src/common/clock/clock';
import { AppConfig } from '../../src/config/app-config';
import { CliOutput } from '../../src/modules/ops-cli/output';
import { Prompt } from '../../src/modules/ops-cli/prompt';

import { TEST_JWT_SECRET } from './test-app';

/** Collects what a command prints instead of writing to the terminal. */
export class CapturedOutput extends CliOutput {
  lines: string[] = [];
  errors: string[] = [];

  override line(text = ''): void {
    this.lines.push(text);
  }

  override error(text: string): void {
    this.errors.push(text);
  }

  get text(): string {
    return this.lines.join('\n');
  }

  clear(): void {
    this.lines = [];
    this.errors = [];
  }
}

/** Answers confirmations with a preset answer and remembers the questions. */
export class ScriptedPrompt extends Prompt {
  answer = true;
  questions: string[] = [];

  confirm(question: string, { yes }: { yes: boolean }): Promise<boolean> {
    this.questions.push(question);
    return Promise.resolve(yes || this.answer);
  }
}

export interface TestCli {
  module: TestingModule;
  output: CapturedOutput;
  prompt: ScriptedPrompt;
}

/** The ops CLI's providers against a test database; tests call `command.run()` directly. */
export async function createTestCli(options: {
  databaseUrl: string;
  clock: Clock;
}): Promise<TestCli> {
  const output = new CapturedOutput();
  const prompt = new ScriptedPrompt();
  const config = AppConfig.fromEnv({
    NODE_ENV: 'test',
    DATABASE_URL: options.databaseUrl,
    JWT_ACCESS_SECRET: TEST_JWT_SECRET,
    LOG_LEVEL: 'silent',
    WEB_BASE_URL: 'http://localhost:5173',
  });
  const module = await Test.createTestingModule({ imports: [CliModule] })
    .overrideProvider(AppConfig)
    .useValue(config)
    .overrideProvider(Clock)
    .useValue(options.clock)
    .overrideProvider(CliOutput)
    .useValue(output)
    .overrideProvider(Prompt)
    .useValue(prompt)
    .compile();
  await module.init();
  return { module, output, prompt };
}
