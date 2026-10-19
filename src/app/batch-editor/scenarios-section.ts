import { CurrencyPipe, DecimalPipe, PercentPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  model,
} from '@angular/core';
import { FormArray, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import type { ScenarioAnalysis } from '@shared/calc';
import { type ScenarioGroup, createScenarioGroup, createStageGroup, defaultScenario, toScenarioInput } from './batch-form';

const MAX_SCENARIOS = 20;
const MAX_STAGES = 50;

@Component({
  selector: 'app-scenarios-section',
  imports: [
    CurrencyPipe,
    DecimalPipe,
    PercentPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTabsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './scenarios-section.html',
  styleUrl: './scenarios-section.scss',
})
export class ScenariosSection {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly scenarios = input.required<FormArray<ScenarioGroup>>();
  readonly analyses = input.required<ScenarioAnalysis[]>();
  readonly currency = input.required<string>();
  readonly price = input.required<number>();
  readonly selectedIndex = model(0);

  readonly maxScenarios = MAX_SCENARIOS;
  readonly maxStages = MAX_STAGES;

  /** Per-stage money figures of each scenario at the current base price. */
  readonly stageResults = computed(() => this.analyses().map((analysis) => analysis.stagesAt(this.price())));

  addScenario(): void {
    const scenarios = this.scenarios();
    if (scenarios.length >= MAX_SCENARIOS) return;
    // Start from a copy of the current scenario: alternatives usually differ in a stage or two.
    const current = scenarios.at(this.selectedIndex());
    const source = current ? toScenarioInput(current.getRawValue()) : defaultScenario();
    scenarios.push(createScenarioGroup(this.fb, { name: `Сценарій ${scenarios.length + 1}`, stages: source.stages }));
    this.selectedIndex.set(scenarios.length - 1);
  }

  removeScenario(index: number): void {
    const scenarios = this.scenarios();
    if (scenarios.length <= 1) return;
    scenarios.removeAt(index);
    this.selectedIndex.set(Math.min(index, scenarios.length - 1));
  }

  addStage(scenario: ScenarioGroup, scenarioIndex: number): void {
    const stages = scenario.controls.stages;
    if (stages.length >= MAX_STAGES) return;
    const values = stages.getRawValue();
    // Percent values: share fills what's left up to 100%, discount goes 10 points deeper (at most 90%).
    const sharesTotal = values.reduce((sum, stage) => sum + (stage.share ?? 0), 0);
    const remaining = Math.max(0, Math.round((100 - sharesTotal) * 1e6) / 1e6);
    const discount = Math.min((values.at(-1)?.discount ?? 0) + 10, 90);
    stages.push(createStageGroup(this.fb, { share: remaining / 100, discount: discount / 100, months: 1 }));
    this.focusAfterRender(`#stage-${scenarioIndex}-${stages.length - 1}-share`);
  }

  removeStage(scenario: ScenarioGroup, scenarioIndex: number, index: number): void {
    const stages = scenario.controls.stages;
    if (stages.length <= 1) return;
    stages.removeAt(index);
    this.focusAfterRender(`#add-stage-${scenarioIndex}`);
  }

  moveStage(scenario: ScenarioGroup, scenarioIndex: number, index: number, direction: -1 | 1): void {
    const stages = scenario.controls.stages;
    const target = index + direction;
    if (target < 0 || target >= stages.length) return;
    const stage = stages.at(index);
    stages.removeAt(index, { emitEvent: false });
    stages.insert(target, stage);
    // Keep focus on the moved stage; fall back to the other arrow at the list edges.
    const edge = (direction === -1 && target === 0) || (direction === 1 && target === stages.length - 1);
    const button = (direction === -1) !== edge ? 'up' : 'down';
    this.focusAfterRender(`#stage-${scenarioIndex}-${target}-${button}`);
  }

  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}
