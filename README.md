[![Hippocratic License HL3-FULL](https://img.shields.io/static/v1?label=Hippocratic%20License&message=HL3-FULL&labelColor=5e2751&color=bc8c3d)](https://firstdonoharm.dev/version/3/0/full.html)

# A TypeScript implementation of "Complete and Easy Bidirectional Typechecking for Higher-Rank Polymorphism"[^1] by Dunfield and Krishnaswami

This project contains two implementations of a bidirectional type checker for the Dunfield and Krishnaswami (DK) type system.

The first implementation tries to follow the paper as closely as possible. I did not attempt to find any existing implementations as reference. I may try to find something in the future just for validation, but I think I've faithfully implemented everything.

In the paper, the key insight is to use an ordered context to carefully control the scope of type variables. This gives a very nice formalism for defining the type system. However, this comes with some practical drawbacks. The context is not a usual typing context, but a judgemental context which has to do triple-duty: record the types of variables, declaration order and scope of type variables, and substitutions/solutions for solved constraints.

The second implementation attempts to avoid some of the complexities of this overloaded context by separating the judgement context back into a simple typing context. This is done by tracking depths of binders, loosely inspired by Rémy's algorithm[^2]. By separating the context out, we can also use locally nameless de Bruijn indices and levels.

To try out some features and read more about the project, check out [this blog post](https://verychill.biz/blog/bidirectional-typechecking-dk).

This project also contains an implementation of the classic Damas-Hindley-Milner (HM) type system in a similar style, as a point of comparison.

## Notes

### Extensions

I did allow myself to deviate from the paper in a few ways. I added syntax and rules for

- annotated parameters, terms like `λx:A.e`
- integer literals and Int type.
- pairs and product types

Because there are integers, I use the syntax `Unit` instead of `1`.

These are all extensions on the original system, so if your term doesn't include this syntax, then you will only get derivations in the original system.

Another small difference is that I added let expression syntax support to the DK parsers. These are immediately desugared, so it doesn't change anything about the underlying typechecking, but it makes it easier to compare with HM.

### Paper

There are some technical problems with the proofs in the original paper. See Jinxu Zhao's paper[^3] for more details.

But I think I found a new mistake in their example in Figure 12. It doesn't make a big difference, but it was quite confusing when trying to validate.

```
Γ′ = Γ[β̂₂, β̂₁, α̂ = β̂₁ → β̂₂]
Δ = Γ[β̂₂, β̂₁ = β̂₂, α̂ = β̂₁ → β̂₂]

──────────────────────────────────── InstLReach  ────────────────────────────────────────── InstRReach
Γ′, ›β̂, β̂ ⊢ β̂₁ :≤ β̂ ⊣ Γ′, ›β̂, β̂ = β̂₁             Γ′, ›β̂, β̂ = β̂₁ ⊢ β̂₁ ≤: β̂₂ ⊣ Δ, ›β̂, β̂ = β̂₁
─────────────────────────────────────────────────────────────────────────────────────────── InstRArr
                   Γ[α̂], ›β̂, β̂ ⊢ β̂ → β̂ ≤: α̂ ⊣ Δ, ›β̂, β̂ = β̂₁
                   ──────────────────────────────────────── InstRAllL
                          Γ[α̂] ⊢ ∀β.β → β ≤: α̂ ⊣ Δ
```

The example of instantiation applies the `InstRArr` rule incorrectly, swapping the domain and codomain, leading to an application of `InstRSolve` instead of `InstRReach`.
Notice `α̂` now solves to `β̂₂ → β̂₂` instead of `β̂₁ → β̂₁`.

## Future Work

The current output trace formats always show the entire context. What would be better is if we saw only the differences between steps.

---

[^1]: [Complete and Easy Bidirectional Typechecking for Higher-Rank Polymorphism](https://arxiv.org/abs/1306.6032)
[^2]: [How OCaml type checker works](https://okmij.org/ftp/ML/generalization.html)
[^3]: [Formalization of a Polymorphic Subtyping Algorithm](https://i.cs.hku.hk/~jxzhao/pdf/itp2018.pdf)