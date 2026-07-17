import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { EmotionLogForm } from "../EmotionLogForm";
import { createEmotionLog } from "../../../lib/supabase/emotionLogs";
import type { EmotionLog } from "../../../types/database";

jest.mock("../../../lib/supabase/emotionLogs", () => ({
  createEmotionLog: jest.fn(),
}));

const mockCreateEmotionLog = createEmotionLog as jest.MockedFunction<typeof createEmotionLog>;

const savedLog: EmotionLog = {
  id: "log-1",
  task_id: "task-1",
  score: 4,
  tag: null,
  free_text: null,
  created_at: "2026-07-15T00:00:00Z",
  updated_at: "2026-07-15T00:00:00Z",
};

describe("<EmotionLogForm />", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateEmotionLog.mockResolvedValue(savedLog);
  });

  test("スコア未選択のままでは記録できない（スコアは必須）", async () => {
    await render(
      <EmotionLogForm taskId="task-1" onSaved={jest.fn()} onSkip={jest.fn()} />,
    );
    await fireEvent.press(screen.getByText("記録する"));
    expect(mockCreateEmotionLog).not.toHaveBeenCalled();
  });

  test("スコアのみ選択して記録できる（タグ・自由記述は任意）", async () => {
    const onSaved = jest.fn();
    await render(
      <EmotionLogForm taskId="task-1" onSaved={onSaved} onSkip={jest.fn()} />,
    );

    await fireEvent.press(screen.getByText("🙂")); // score 4
    await fireEvent.press(screen.getByText("記録する"));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(savedLog));
    expect(mockCreateEmotionLog).toHaveBeenCalledWith({
      taskId: "task-1",
      score: 4,
      tag: null,
      freeText: null,
    });
  });

  test("タグを1つ選択して記録できる", async () => {
    await render(
      <EmotionLogForm taskId="task-1" onSaved={jest.fn()} onSkip={jest.fn()} />,
    );

    await fireEvent.press(screen.getByText("😄")); // score 5
    await fireEvent.press(screen.getByText("達成感"));
    await fireEvent.press(screen.getByText("記録する"));

    await waitFor(() =>
      expect(mockCreateEmotionLog).toHaveBeenCalledWith({
        taskId: "task-1",
        score: 5,
        tag: "達成感",
        freeText: null,
      }),
    );
  });

  test("選択済みのタグをもう一度押すと解除される", async () => {
    await render(
      <EmotionLogForm taskId="task-1" onSaved={jest.fn()} onSkip={jest.fn()} />,
    );

    await fireEvent.press(screen.getByText("😐")); // score 3
    await fireEvent.press(screen.getByText("不安"));
    await fireEvent.press(screen.getByText("不安")); // 解除
    await fireEvent.press(screen.getByText("記録する"));

    await waitFor(() =>
      expect(mockCreateEmotionLog).toHaveBeenCalledWith(
        expect.objectContaining({ tag: null }),
      ),
    );
  });

  test("自由記述は「もう少し書く」で展開してから入力できる（2段階入力）", async () => {
    await render(
      <EmotionLogForm taskId="task-1" onSaved={jest.fn()} onSkip={jest.fn()} />,
    );

    // 展開前は自由記述欄が表示されない
    expect(screen.queryByPlaceholderText("よければ、もう少し書いてみてください")).toBeNull();

    await fireEvent.press(screen.getByText("もう少し書く"));
    await fireEvent.changeText(
      screen.getByPlaceholderText("よければ、もう少し書いてみてください"),
      "  今日は集中できた  ",
    );
    await fireEvent.press(screen.getByText("🙂"));
    await fireEvent.press(screen.getByText("記録する"));

    // 前後の空白はtrimして保存される
    await waitFor(() =>
      expect(mockCreateEmotionLog).toHaveBeenCalledWith(
        expect.objectContaining({ freeText: "今日は集中できた" }),
      ),
    );
  });

  test("「あとで」でスキップできる（記録は行われない）", async () => {
    const onSkip = jest.fn();
    await render(
      <EmotionLogForm taskId="task-1" onSaved={jest.fn()} onSkip={onSkip} />,
    );

    await fireEvent.press(screen.getByText("あとで"));

    expect(onSkip).toHaveBeenCalled();
    expect(mockCreateEmotionLog).not.toHaveBeenCalled();
  });

  test("保存に失敗したらエラーメッセージを表示する", async () => {
    mockCreateEmotionLog.mockRejectedValue(new Error("network error"));
    const onSaved = jest.fn();
    await render(
      <EmotionLogForm taskId="task-1" onSaved={onSaved} onSkip={jest.fn()} />,
    );

    await fireEvent.press(screen.getByText("🙂"));
    await fireEvent.press(screen.getByText("記録する"));

    await screen.findByText("network error");
    expect(onSaved).not.toHaveBeenCalled();
  });
});
