import {
  OperationNodeTransformer,
  type KyselyPlugin,
  type PluginTransformQueryArgs,
  type PluginTransformResultArgs,
  type PrimitiveValueListNode,
  type QueryResult,
  type RootOperationNode,
  type UnknownRow,
  type ValueNode,
} from 'kysely';

const withoutNul = (value: unknown): unknown =>
  typeof value === 'string' && value.includes('\0') ? value.replaceAll('\0', '') : value;

class NulTransformer extends OperationNodeTransformer {
  protected override transformValue(node: ValueNode): ValueNode {
    return { ...node, value: withoutNul(node.value) };
  }

  protected override transformPrimitiveValueList(
    node: PrimitiveValueListNode,
  ): PrimitiveValueListNode {
    return { ...node, values: node.values.map(withoutNul) };
  }
}

// Postgres refuses a NUL in text (22021, a 500 for a title or report holding one) and SQLite keeps
// it, so every string sent to either database loses its NULs: text is stored, matched and read
// back the same whichever is behind.
export class StripNulPlugin implements KyselyPlugin {
  readonly #transformer = new NulTransformer();

  transformQuery(args: PluginTransformQueryArgs): RootOperationNode {
    return this.#transformer.transformNode(args.node, args.queryId);
  }

  transformResult(args: PluginTransformResultArgs): Promise<QueryResult<UnknownRow>> {
    return Promise.resolve(args.result);
  }
}
