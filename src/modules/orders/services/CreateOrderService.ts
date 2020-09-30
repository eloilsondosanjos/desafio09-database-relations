import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExists = await this.customersRepository.findById(customer_id);

    if (!customerExists) {
      throw new AppError('Customer does not exist');
    }

    const productExists = await this.productsRepository.findAllById(products);

    if (!productExists.length) {
      throw new AppError('Product not found for these ids');
    }

    const productExistsIds = productExists.map(product => product.id);

    const checkProductInexistents = products.filter(
      product => !productExistsIds.includes(product.id),
    );

    if (checkProductInexistents.length) {
      throw new AppError(`Product not found ${checkProductInexistents[0].id}`);
    }

    const findProductsWithNoQuantityAvaliable = products.filter(
      product =>
        productExists.filter(prod => prod.id === product.id)[0].quantity <
        product.quantity,
    );

    if (findProductsWithNoQuantityAvaliable.length) {
      throw new AppError(
        `Quantity ${findProductsWithNoQuantityAvaliable[0].quantity} greater product ${findProductsWithNoQuantityAvaliable[0].id} balance`,
      );
    }

    const allDataProductsToSave = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: productExists.filter(prod => prod.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: customerExists,
      products: allDataProductsToSave,
    });

    const { order_products } = order;

    const orderProductsQuantity = order_products.map(product => ({
      id: product.product_id,
      quantity:
        productExists.filter(prod => prod.id === product.product_id)[0]
          .quantity - product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
