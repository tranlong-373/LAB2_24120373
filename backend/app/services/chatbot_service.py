from __future__ import annotations

from dataclasses import dataclass
from threading import Lock, Thread
from typing import Any


@dataclass(frozen=True)
class GenerationConfig:
    max_new_tokens: int = 80
    max_input_tokens: int = 768
    do_sample: bool = False
    temperature: float = 0.7
    top_p: float = 0.9


class ChatbotService:
    def __init__(
        self,
        model_name: str = "Qwen/Qwen2.5-0.5B-Instruct",
        config: GenerationConfig | None = None,
    ) -> None:
        self.model_name = model_name
        self.config = config or GenerationConfig()
        self.system_prompt = (
            "Bạn là trợ lí AI hỏi đáp thân thiện, hãy trả lời rõ ràng, "
            "ngắn gọn và dễ hiểu bằng tiếng Việt. Mỗi câu trả lời tối đa 3 câu. "
            "Không dùng tiếng Trung hoặc ký tự Hán."
        )
        self.device = "cpu"
        self._tokenizer: Any | None = None
        self._model: Any | None = None
        self._torch: Any | None = None
        self._load_lock = Lock()
        self._state_lock = Lock()
        self._loading = False
        self._load_error: str | None = None
        self._preload_started = False

    def _load_model(self) -> None:
        if self._tokenizer is not None and self._model is not None:
            return

        with self._load_lock:
            if self._tokenizer is not None and self._model is not None:
                return

            self._loading = True
            self._load_error = None

            try:
                import torch
                from transformers import AutoModelForCausalLM, AutoTokenizer

                self.device = "cuda" if torch.cuda.is_available() else "cpu"
                tokenizer = AutoTokenizer.from_pretrained(self.model_name)
                model = AutoModelForCausalLM.from_pretrained(
                    self.model_name,
                    torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
                )
                model.to(self.device)
                model.eval()

                self._torch = torch
                self._tokenizer = tokenizer
                self._model = model
            except ImportError as exc:
                self._load_error = (
                    "Thiếu thư viện chạy model Hugging Face. "
                    "Hãy cài lại môi trường bằng `pip install -r requirements.txt`."
                )
                raise RuntimeError(self._load_error) from exc
            except Exception as exc:
                self._load_error = str(exc)
                raise
            finally:
                self._loading = False

    def preload_in_background(self) -> None:
        with self._state_lock:
            if self.is_ready() or self._loading or self._preload_started:
                return
            self._preload_started = True

        thread = Thread(target=self._preload_worker, daemon=True)
        thread.start()

    def _preload_worker(self) -> None:
        try:
            self._load_model()
        except Exception:
            with self._state_lock:
                self._preload_started = False

    def is_ready(self) -> bool:
        return self._tokenizer is not None and self._model is not None

    def is_loading(self) -> bool:
        return self._loading

    def get_load_error(self) -> str | None:
        return self._load_error

    def get_model_name(self) -> str:
        return self.model_name

    def generate(self, message: str) -> str:
        cleaned_message = message.strip()
        if not cleaned_message:
            raise ValueError("'message' không được để trống.")

        self._load_model()

        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": cleaned_message},
        ]

        prompt = self._tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )
        inputs = self._tokenizer(prompt, return_tensors="pt").to(self.device)
        input_length = inputs["input_ids"].shape[-1]

        if input_length > self.config.max_input_tokens:
            inputs["input_ids"] = inputs["input_ids"][:, -self.config.max_input_tokens :]
            if "attention_mask" in inputs:
                inputs["attention_mask"] = inputs["attention_mask"][
                    :,
                    -self.config.max_input_tokens :,
                ]

        generation_args = {
            "max_new_tokens": self.config.max_new_tokens,
            "do_sample": self.config.do_sample,
            "use_cache": True,
            "pad_token_id": self._tokenizer.eos_token_id,
            "eos_token_id": self._tokenizer.eos_token_id,
        }

        if self.config.do_sample:
            generation_args["temperature"] = self.config.temperature
            generation_args["top_p"] = self.config.top_p

        with self._torch.inference_mode():
            outputs = self._model.generate(
                **inputs,
                **generation_args,
            )

        generated_tokens = outputs[0][inputs["input_ids"].shape[-1] :]
        result = self._tokenizer.decode(
            generated_tokens,
            skip_special_tokens=True,
        ).strip()

        if not result:
            raise RuntimeError("Model không tạo được nội dung trả lời.")

        return result


chatbot_service = ChatbotService()


def generate(message: str) -> str:
    return chatbot_service.generate(message)
