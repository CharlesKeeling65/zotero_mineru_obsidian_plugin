export interface AIActionRequest {
  targetId: string;
  prompt: string;
}

export interface AIProvider {
  summarizeBlock(request: AIActionRequest): Promise<string>;
  explainFigure(request: AIActionRequest): Promise<string>;
  explainTable(request: AIActionRequest): Promise<string>;
  explainFormula(request: AIActionRequest): Promise<string>;
  summarizeSection(request: AIActionRequest): Promise<string>;
}
