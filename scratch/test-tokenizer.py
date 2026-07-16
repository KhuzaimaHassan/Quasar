from google.genai import local_tokenizer

tokenizer = local_tokenizer.LocalTokenizer()
print("dir(tokenizer):", dir(tokenizer))
try:
    res = tokenizer.count_tokens("Hello world")
    print("res:", res)
    print("type(res):", type(res))
    if hasattr(res, "total_tokens"):
        print("total_tokens:", res.total_tokens)
except Exception as e:
    print("Error:", e)
